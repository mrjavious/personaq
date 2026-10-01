'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Film,
  Video,
  Sparkles,
  Upload,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Layers,
  Download,
  Info,
  Play,
  Maximize2,
  Sliders,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import { VisualModelOptions } from '@/lib/persona/visual-types';

interface PersonaSummary {
  id: string;
  name: string;
  adultAge: number;
  avatarUrl?: string | null;
  visualModelConfig?: string | null;
  appearanceNotes?: string;
  contentPillars?: string | string[];
}

interface MediaAsset {
  id: string;
  url: string;
  type: string;
  tags?: string;
  provenanceMeta?: string;
  createdAt: string;
}

export default function ContentManagerPage() {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<PersonaSummary | null>(null);
  const [loadingPersonas, setLoadingPersonas] = useState(true);

  // Content Creation Modes
  const [creationMode, setCreationMode] = useState<'prompt' | 'reimagine'>('prompt');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  // Prompt Parameters
  const [prompt, setPrompt] = useState(
    'Walking through a sunlit courtyard wearing authentic traditional attire, warm confident smile, golden hour lighting, cinematic master photography'
  );
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '4:5' | '16:9'>('1:1');
  const [cameraAngle, setCameraAngle] = useState<'front' | 'three_quarter' | 'profile' | 'candid'>('front');
  const [cameraMotion, setCameraMotion] = useState<'zoom_in' | 'orbit' | 'pan_tracking' | 'static'>('zoom_in');
  const [sceneSetting] = useState('courtyard');

  // Reference Content Reimagining Mode
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceFilePreview, setReferenceFilePreview] = useState<string | null>(null);
  const [referenceFileType, setReferenceFileType] = useState<'image' | 'video'>('image');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [reimaginePrompt, setReimaginePrompt] = useState(
    'Recreate the exact composition, pose, and aesthetic of this reference, but featuring the selected persona with her authentic physical features and styling.'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Execution State
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generated Result
  const [generatedResult, setGeneratedResult] = useState<{
    url: string;
    type: 'image' | 'video';
    prompt: string;
    aspectRatio: string;
    metadata?: Record<string, unknown>;
  } | null>(null);

  // Recent Persona Content Library
  const [recentAssets, setRecentAssets] = useState<MediaAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // 1. Fetch available personas
  useEffect(() => {
    async function fetchPersonas() {
      try {
        setLoadingPersonas(true);
        const res = await fetch('/api/persona?all=true');
        const data = await res.json();
        const list = data.allPersonas || data.personas || (data.persona ? [data.persona] : []);
        if (list.length > 0) {
          setPersonas(list);
          setSelectedPersonaId(list[0].id);
          setSelectedPersona(list[0]);
          loadPersonaAssets(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load personas:', err);
      } finally {
        setLoadingPersonas(false);
      }
    }

    fetchPersonas();
  }, []);

  const loadPersonaAssets = async (personaId: string) => {
    try {
      setLoadingAssets(true);
      const res = await fetch(`/api/assets?personaId=${personaId}&limit=8`);
      const data = await res.json();
      if (data.assets) {
        setRecentAssets(
          data.assets.map((a: { id: string; url: string | null; type: string; tags: string | null; provenanceMeta: string | null; createdAt: string }) => ({
            id: a.id,
            url: a.url || '',
            type: a.type,
            tags: a.tags || '',
            provenanceMeta: a.provenanceMeta || '',
            createdAt: a.createdAt,
          }))
        );
      } else {
        setRecentAssets([]);
      }
    } catch (err) {
      console.error(err);
      setRecentAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSelectPersona = (id: string) => {
    setSelectedPersonaId(id);
    const p = personas.find((x) => x.id === id);
    if (p) {
      setSelectedPersona(p);
      setGeneratedResult(null);
      loadPersonaAssets(p.id);
    }
  };

  // Parse Physical DNA from Selected Persona
  const parsedDna: Partial<VisualModelOptions> = (() => {
    if (!selectedPersona?.visualModelConfig) return {};
    try {
      return JSON.parse(selectedPersona.visualModelConfig);
    } catch {
      return {};
    }
  })();

  const handleReferenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReferenceFile(file);
    const isVideo = file.type.startsWith('video/');
    setReferenceFileType(isVideo ? 'video' : 'image');
    if (isVideo) {
      setMediaType('video');
      setAspectRatio('9:16');
    }

    const previewUrl = URL.createObjectURL(file);
    setReferenceFilePreview(previewUrl);
  };

  const handleGenerateContent = async () => {
    if (!selectedPersona) {
      setError('Please select an active persona first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let uploadedReferenceUrl: string | undefined = undefined;

      if (creationMode === 'reimagine' && referenceFile) {
        setUploadingReference(true);
        const formData = new FormData();
        formData.append('file', referenceFile);

        const uploadRes = await fetch('/api/persona/upload-reference', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        setUploadingReference(false);

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Failed to process reference file.');
        }

        uploadedReferenceUrl = uploadData.imageUrl;
      }

      const effectivePrompt =
        creationMode === 'reimagine'
          ? `${reimaginePrompt} — [Anchored to ${selectedPersona.name} identity]`.trim()
          : prompt.trim();

      const res = await fetch('/api/persona/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          mediaType,
          prompt: effectivePrompt,
          aspectRatio,
          cameraAngle,
          cameraMotion,
          sceneSetting,
          referenceContentUrl: uploadedReferenceUrl,
          reimagineMode: creationMode === 'reimagine',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Content generation failed');
      }

      setGeneratedResult({
        url: data.mediaUrl,
        type: data.type,
        prompt: data.prompt,
        aspectRatio: data.metadata?.aspectRatio || aspectRatio,
        metadata: data.metadata,
      });

      setSuccessMessage(
        creationMode === 'reimagine'
          ? `Successfully reimagined reference content with ${selectedPersona.name}'s identity!`
          : `Successfully generated ${mediaType === 'video' ? 'AI video reel' : 'photorealistic image'} anchored to ${selectedPersona.name}!`
      );

      loadPersonaAssets(selectedPersona.id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setUploadingReference(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header & Persona Selector Dropdown */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60">
              <Film className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Content Studio • Media Pipeline
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Persona Content Manager
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Create social media images and vertical 9:16 video reels anchored to your selected persona&apos;s physical DNA. Or upload reference reels to reimagine existing content with your persona&apos;s face and styling.
            </p>
          </div>

          {/* Persona Selector Dropdown Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs min-w-[280px]">
            <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center justify-between">
              <span>Select Active Persona</span>
              {loadingPersonas && <RefreshCw className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />}
            </label>

            <div className="relative">
              <select
                value={selectedPersonaId}
                onChange={(e) => handleSelectPersona(e.target.value)}
                className="w-full h-10 appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-lg px-3 text-xs text-slate-900 dark:text-white font-medium focus:border-indigo-500 pr-8 transition-colors cursor-pointer"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Age {p.adultAge}) {p.avatarUrl ? '• Model Active' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            {selectedPersona && (
              <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                {selectedPersona.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPersona.avatarUrl}
                    alt={selectedPersona.name}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-400 font-bold text-xs">
                    {selectedPersona.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {selectedPersona.name}
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Age {selectedPersona.adultAge} • Adult Verified
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Persona Physical DNA Badges */}
        {selectedPersona && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Locked Identity DNA:
              </span>

              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-medium">
                Face: {parsedDna.faceCard?.jawline?.replace(/_/g, ' ') || 'Soft Oval'} • {parsedDna.faceCard?.eyeShape?.replace(/_/g, ' ') || 'Almond'}
              </span>

              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-medium">
                Dimple: {parsedDna.dimple?.type?.replace(/_/g, ' ') || 'Cheek Dimples'}
              </span>

              <span className="px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 font-medium">
                Marks: {parsedDna.distinctiveMarks?.moles?.replace(/_/g, ' ') || 'Upper Lip Mole'}
              </span>

              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-medium">
                Body: {parsedDna.bodyProportions?.silhouette?.replace(/_/g, ' ') || 'Hourglass'}
              </span>
            </div>

            <Link
              href={`/persona?id=${selectedPersona.id}`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline shrink-0"
            >
              <span>Manage Visual Model &amp; Physical Features</span>
              <span>&rarr;</span>
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5">
          <Info className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* CONTENT & SCENE PRODUCTION */}
      <div className="space-y-6">
          {/* Creation Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreationMode('prompt')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                creationMode === 'prompt'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              1. Direct Prompt Generation
            </button>

        <button
          type="button"
          onClick={() => setCreationMode('reimagine')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            creationMode === 'reimagine'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          2. Reimagine Reference Content
          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-medium">
            New
          </span>
        </button>
      </div>

      {/* Studio Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Controls & Prompts (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Format Selection (Image vs Video) */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
            <label className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider block">
              Content Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMediaType('image');
                  if (aspectRatio === '9:16') setAspectRatio('1:1');
                }}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  mediaType === 'image'
                    ? 'bg-indigo-50/50 dark:bg-indigo-600/15 border-indigo-500 text-slate-900 dark:text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${mediaType === 'image' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Photorealistic Image</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">High-definition feeds &amp; portraits</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaType('video');
                  setAspectRatio('9:16');
                }}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  mediaType === 'video'
                    ? 'bg-indigo-50/50 dark:bg-indigo-600/15 border-indigo-500 text-slate-900 dark:text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${mediaType === 'video' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">AI Video Reel (9:16)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Vertical social reels with camera motion</div>
                </div>
              </button>
            </div>
          </div>

          {/* MODE 1: DIRECT PROMPT */}
          {creationMode === 'prompt' && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                  Scene &amp; Visual Prompt
                </label>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                  Anchored to {selectedPersona?.name}
                </span>
              </div>

              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the action, clothing, atmosphere, lighting..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
              />

              {/* Quick Scenario Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Quick scene presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Urban Cafe Co-working', p: 'Sitting at a chic outdoor cafe with a matcha latte and laptop, smiling candidly, morning sun' },
                    { label: 'Traditional Temple Courtyard', p: 'Walking gracefully through an ancient courtyard, rich silk attire, brass lamps, golden hour' },
                    { label: 'Tech Conference Keynote', p: 'On stage delivering a compelling keynote on generative AI and culture, sharp tailored charcoal blazer, smart wireless mic' },
                    { label: 'Sunset Rooftop Lounge', p: 'Standing at a stylish rooftop terrace at sunset overlooking glowing city lights, soft breeze in hair, elegant evening attire' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setPrompt(chip.p)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: REIMAGINE REFERENCE CONTENT */}
          {creationMode === 'reimagine' && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Upload Reference Content (Reel or Photo)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload an existing reel or image. The engine reimagines the composition and posture featuring {selectedPersona?.name}.
                  </p>
                </div>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
                  SFW Reimagining
                </span>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleReferenceFileChange}
                  className="hidden"
                  id="content-reference-input"
                />

                {referenceFilePreview ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {referenceFileType === 'video' ? (
                        <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                          <Video className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={referenceFilePreview}
                          alt="Reference content preview"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Reference Content Loaded
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs font-mono">
                          {referenceFile?.name}
                        </div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase font-medium">
                          {referenceFileType} • Ready to Reimagine
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReferenceFile(null);
                        setReferenceFilePreview(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-medium"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="content-reference-input"
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-all text-center group"
                  >
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2 transition-colors" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white">
                      Drop or click to upload Reference Reel (MP4) or Reference Image
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      MP4, WebM, PNG, JPG up to 50MB • SFW verification enforced
                    </span>
                  </label>
                )}
              </div>

              {/* Reimagining Guidance */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Reimagining Instructions
                </label>
                <textarea
                  rows={3}
                  value={reimaginePrompt}
                  onChange={(e) => setReimaginePrompt(e.target.value)}
                  placeholder="Tell the engine how to reinterpret the reference scene..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* Perspective & Aspect Ratio Settings */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Composition, Aspect Ratio &amp; Camera Angle
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '1:1', label: '1:1 (Square Feed)' },
                    { id: '9:16', label: '9:16 (Reels/Story)' },
                    { id: '4:5', label: '4:5 (IG Portrait)' },
                    { id: '16:9', label: '16:9 (Landscape)' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAspectRatio(r.id as typeof aspectRatio)}
                      className={`h-9 px-2 rounded-lg border text-center text-xs font-medium transition-all ${
                        aspectRatio === r.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Angle */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Persona Camera Perspective
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'front', label: 'Front (0°)' },
                    { id: 'three_quarter', label: '3/4 View (45°)' },
                    { id: 'profile', label: 'Side Profile (90°)' },
                    { id: 'candid', label: 'Candid Motion' },
                  ].map((ang) => (
                    <button
                      key={ang.id}
                      type="button"
                      onClick={() => setCameraAngle(ang.id as typeof cameraAngle)}
                      className={`h-9 px-2 rounded-lg border text-center text-xs font-medium transition-all ${
                        cameraAngle === ang.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {ang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Motion Animation Selector */}
            {mediaType === 'video' && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  Camera Motion Mode (9:16 Video Reel)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'zoom_in', label: 'Slow Zoom In' },
                    { id: 'orbit', label: 'Orbit Arc (3D)' },
                    { id: 'pan_tracking', label: 'Tracking Walk' },
                    { id: 'static', label: 'Static Focus' },
                  ].map((mot) => (
                    <button
                      key={mot.id}
                      type="button"
                      onClick={() => setCameraMotion(mot.id as typeof cameraMotion)}
                      className={`h-9 px-2 rounded-lg border text-center text-xs font-medium transition-all ${
                        cameraMotion === mot.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {mot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={generating || uploadingReference}
            onClick={handleGenerateContent}
            className="w-full h-11 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating || uploadingReference ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {uploadingReference
                  ? 'Analyzing & Scanning Reference Content...'
                  : `Generating ${mediaType === 'video' ? 'AI Video Reel' : 'Image'} with ${selectedPersona?.name}...`}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {creationMode === 'reimagine'
                  ? `Reimagine Content with ${selectedPersona?.name}`
                  : `Create ${mediaType === 'video' ? 'AI Video Reel' : 'Photorealistic Image'}`}
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Output Preview & Asset Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 sticky top-20 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {mediaType === 'video' ? <Video className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                Live Media Canvas
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {generatedResult?.type.toUpperCase() || mediaType.toUpperCase()} • {aspectRatio}
              </span>
            </div>

            {/* Canvas Display */}
            <div
              className={`relative w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center ${
                aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[500px] mx-auto' : 'aspect-square'
              }`}
            >
              {generating ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="w-10 h-10 rounded-full border-3 border-indigo-200 dark:border-indigo-500/20 border-t-indigo-600 animate-spin" />
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Synthesizing Media...
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-xs">
                    Applying {selectedPersona?.name}&apos;s facial bone structure, skin complexion, and physical traits.
                  </p>
                </div>
              ) : generatedResult ? (
                generatedResult.type === 'video' ? (
                  <div className="relative w-full h-full">
                    <video
                      key={generatedResult.url}
                      src={generatedResult.url}
                      controls
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white border border-slate-700 font-mono shadow-xs flex items-center gap-1.5">
                      <Play className="w-3 h-3 text-indigo-400" />
                      9:16 Video Reel
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={generatedResult.url}
                      src={generatedResult.url}
                      alt="Generated Persona Content"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white border border-slate-700 font-mono flex items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Anchored Identity
                    </div>
                  </div>
                )
              ) : (
                <div className="p-8 text-center space-y-3 text-slate-400">
                  <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    {mediaType === 'video' ? <Video className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No Media Generated Yet
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Select a persona, choose your format, and click generate or reimagine.
                  </p>
                </div>
              )}
            </div>

            {/* Download Button */}
            {generatedResult && (
              <div className="pt-2">
                <a
                  href={generatedResult.url}
                  download={`content_${selectedPersona?.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${generatedResult.type === 'video' ? 'mp4' : 'jpg'}`}
                  className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download {generatedResult.type === 'video' ? 'MP4 Video Reel' : 'JPEG Image'}
                </a>
              </div>
            )}

            {/* Recent Persona Content Gallery */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {selectedPersona?.name}&apos;s Media Library ({recentAssets.length})
                </span>
                {loadingAssets && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
              </div>

              {recentAssets.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {recentAssets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setGeneratedResult({
                          url: asset.url,
                          type: asset.type === 'video' ? 'video' : 'image',
                          prompt: 'Saved asset from library',
                          aspectRatio: '1:1',
                        });
                      }}
                      className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-indigo-500 cursor-pointer group"
                    >
                      {asset.type === 'video' ? (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                          <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.url}
                          alt="Asset thumbnail"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 text-center py-3">
                  All images and videos generated for {selectedPersona?.name} will appear here.
                </div>
              )}
            </div>

            {/* SFW Guardrail Indicator */}
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 flex items-start gap-2.5 text-[11px] text-indigo-800 dark:text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Guardrails Active:</strong> All content strictly enforces verified adult persona age (&ge;21), SFW suitability, and synthetic character disclosure.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}


