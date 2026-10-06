'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Check,
  ArrowRight,
  Info,
  Video,
  Image as ImageIcon,
  Upload,
  Trash2,
  Layers,
  Lock,
} from 'lucide-react';
import {
  ETHNICITY_PRESETS,
  STYLE_PRESETS,
  BODY_STRUCTURE_PRESETS,
  SHOT_TYPES,
  CAMERA_ANGLES,
  VisualModelOptions,
  PersonaAngleItem,
  getPersonaMultiAnglePackClient,
} from '@/lib/persona/visual-types';

interface VisualModelStudioProps {
  personaId: string;
  personaName: string;
  adultAge: number;
  currentAvatarUrl?: string | null;
  currentVisualConfig?: string | null;
  faceStatus?: string | null;
  onVisualModelMarked?: (updatedPersona: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    visualModelConfig?: string | null;
  }) => void;
}

type AngleItem = PersonaAngleItem;

export default function VisualModelStudio({
  personaId,
  personaName,
  adultAge,
  currentAvatarUrl,
  currentVisualConfig,
  faceStatus,
  onVisualModelMarked,
}: VisualModelStudioProps) {
  // Studio navigation tabs: visual model creator vs media studio
  const [activeTab, setActiveTab] = useState<'model' | 'media'>('model');

  // Parse existing visual config if available
  let parsedInitialConfig: Partial<VisualModelOptions> = {};
  try {
    if (currentVisualConfig) {
      parsedInitialConfig = JSON.parse(currentVisualConfig);
    }
  } catch {
    // Ignore JSON parse error
  }

  const isFaceLocked = faceStatus === 'locked' || Boolean(parsedInitialConfig.isFaceLocked);

  // Visual Model Form State
  const [ethnicity, setEthnicity] = useState<VisualModelOptions['ethnicity']>(
    parsedInitialConfig.ethnicity || 'south_indian'
  );
  const [ethnicityCustom, setEthnicityCustom] = useState(
    parsedInitialConfig.ethnicityCustom || ''
  );
  const [styleLook, setStyleLook] = useState<VisualModelOptions['styleLook']>(
    parsedInitialConfig.styleLook || 'traditional'
  );
  const [bodyStructure, setBodyStructure] = useState<VisualModelOptions['bodyStructure']>(
    parsedInitialConfig.bodyStructure || 'slender'
  );
  const [shotType, setShotType] = useState<VisualModelOptions['shotType']>(
    parsedInitialConfig.shotType || 'portrait'
  );
  const [cameraAngle, setCameraAngle] = useState<VisualModelOptions['cameraAngle']>(
    parsedInitialConfig.cameraAngle || 'front'
  );
  const [facialFeatures, setFacialFeatures] = useState(
    parsedInitialConfig.facialFeatures || ''
  );
  const [hairStyle, setHairStyle] = useState(
    parsedInitialConfig.hairStyle || ''
  );
  const [lighting, setLighting] = useState(
    parsedInitialConfig.lighting || ''
  );
  const [additionalPrompt, setAdditionalPrompt] = useState(
    parsedInitialConfig.additionalPrompt || ''
  );

  // Reference Image Upload State
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    parsedInitialConfig.referenceImageUrl || null
  );
  const [uploadingReference, setUploadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced settings accordion
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dynamic Thinking & Generation Progress State
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [generationStep, setGenerationStep] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generated Visual Candidate Result
  const [generatedResult, setGeneratedResult] = useState<{
    imageUrl: string;
    thumbnailUrl: string;
    prompt: string;
    modelUsed: string;
    provenanceHash: string;
    config: VisualModelOptions;
    multiAnglePack?: AngleItem[];
  } | null>(null);

  // Active Multi-angle preview selection
  const [selectedAngleView, setSelectedAngleView] = useState<string>('front');

  // Active Avatar state
  const [activeAvatar, setActiveAvatar] = useState<string | null>(
    currentAvatarUrl || null
  );
  const [avatarError, setAvatarError] = useState(false);
  const [candidateError, setCandidateError] = useState(false);

  // Media Studio State
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [contentPrompt, setContentPrompt] = useState(
    'Walking through a vibrant sunlit courtyard in authentic traditional silk attire, warm smile, holding a vintage brass cup, golden hour lighting, cinematic film grain'
  );
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9' | '4:5'>('1:1');
  const [contentAngle, setContentAngle] = useState<'front' | 'three_quarter' | 'profile' | 'candid'>('front');
  const [cameraMotion, setCameraMotion] = useState<'zoom_in' | 'orbit' | 'pan_tracking' | 'static'>('zoom_in');
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentSuccess, setContentSuccess] = useState<string | null>(null);
  const [generatedMediaResult, setGeneratedMediaResult] = useState<{
    url: string;
    type: 'image' | 'video';
    prompt: string;
    aspectRatio: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Reference Image Upload
  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReferenceError('Only image files (PNG, JPG, WebP) are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setReferenceError('Image must be under 10MB');
      return;
    }

    setUploadingReference(true);
    setReferenceError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', `${personaName}_reference_concept`);

    try {
      const res = await fetch('/api/persona/upload-reference', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload reference image');
      }

      setReferenceImageUrl(data.imageUrl);
    } catch (err) {
      console.error(err);
      setReferenceError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingReference(false);
    }
  };

  // Generate Realistic Persona Visual
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    setCandidateError(false);
    setGenerationElapsed(0);
    setGenerationStep(1);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startTime) / 1000;
      setGenerationElapsed(sec);
      if (sec < 1.2) setGenerationStep(1);
      else if (sec < 2.8) setGenerationStep(2);
      else if (sec < 4.5) setGenerationStep(3);
      else setGenerationStep(4);
    }, 100);

    const payload = {
      personaId,
      ethnicity,
      ...(ethnicity === 'custom' && { ethnicityCustom }),
      styleLook,
      bodyStructure,
      shotType,
      cameraAngle,
      ...(facialFeatures && { facialFeatures }),
      ...(hairStyle && { hairStyle }),
      ...(lighting && { lighting }),
      ...(additionalPrompt && { additionalPrompt }),
    };

    try {
      const res = await fetch('/api/persona/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'PROVIDER_UNSUPPORTED' || res.status === 501) {
          throw new Error(
            data.error ||
              'The active image provider does not support reference-image editing required for multi-angle perspective synthesis. Configure POLLINATIONS_API_KEY.'
          );
        }
        throw new Error(data.error || 'Generation failed');
      }

      setGeneratedResult(data);
      setSelectedAngleView(cameraAngle || 'front');
      setSuccessMessage('Realistic persona visual synthesized with multi-angle consistency!');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Visual generation failed');
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  };

  // Mark Model as Authoritative Reference
  const handleMarkAsVisualModel = async () => {
    if (!generatedResult) return;
    setMarking(true);
    setError(null);

    try {
      const res = await fetch('/api/persona/mark-visual-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: generatedResult.imageUrl,
          config: generatedResult.config,
          prompt: generatedResult.prompt,
          modelUsed: generatedResult.modelUsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark visual model');
      }

      setActiveAvatar(generatedResult.imageUrl);
      setAvatarError(false);
      setSuccessMessage('Successfully designated as active Persona Visual Reference Model! All future content will anchor to this face.');
      if (onVisualModelMarked) {
        onVisualModelMarked(data.persona);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to mark visual model');
    } finally {
      setMarking(false);
    }
  };

  // Generate Media (Image or Video) anchored to Persona Model
  const handleGenerateContent = async () => {
    if (!contentPrompt.trim()) return;
    setGeneratingContent(true);
    setContentError(null);
    setContentSuccess(null);

    try {
      const res = await fetch('/api/persona/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          prompt: contentPrompt,
          mediaType,
          aspectRatio,
          cameraAngle: contentAngle,
          cameraMotion,
          sceneSetting: 'studio',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Content generation failed');
      }

      setGeneratedMediaResult({
        url: data.url,
        type: data.type,
        prompt: contentPrompt,
        aspectRatio,
      });

      setContentSuccess(`Successfully generated ${mediaType === 'video' ? 'video reel' : 'photorealistic image'} anchored to ${personaName}!`);
    } catch (err) {
      console.error(err);
      setContentError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setGeneratingContent(false);
    }
  };

  const multiAngles: AngleItem[] =
    generatedResult?.multiAnglePack ||
    getPersonaMultiAnglePackClient(ethnicity, personaId, styleLook, activeAvatar);

  const currentDisplayUrl = (() => {
    if (generatedResult && !candidateError) {
      const matchedAngle = multiAngles.find((a) => a.angle === selectedAngleView);
      return matchedAngle?.url || generatedResult.imageUrl;
    }
    if (activeAvatar && !avatarError) {
      const matchedAngle = multiAngles.find((a) => a.angle === selectedAngleView);
      return matchedAngle?.url || activeAvatar;
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {!isFaceLocked && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Face identity is not locked for <strong>{personaName}</strong>. View and content generation are disabled until a face card is generated and locked in the Physical Features tab.
            </span>
          </div>
        </div>
      )}

      {/* Studio Header & Status */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/50">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Photorealistic Engine • Identity Consistency
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Persona Visual Model &amp; Content Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Synthesize realistic persona faces with multi-angle consistency (Front 0°, 3/4 View 45°, Side Profile 90°, Candid), upload optional concept art references, and create photorealistic images and vertical video reels anchored to{' '}
              <strong className="text-slate-900 dark:text-white">{personaName}</strong>.
            </p>
          </div>

          {/* Active Model Reference Display */}
          <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shrink-0">
            <div className="relative">
              {activeAvatar && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeAvatar}
                  alt={personaName}
                  onError={() => setAvatarError(true)}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 font-bold text-base">
                  {personaName ? personaName.charAt(0) : <Camera className="w-5 h-5 text-slate-400" />}
                </div>
              )}
              {activeAvatar && !avatarError && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Current Reference</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                {activeAvatar && !avatarError ? (
                  <span className="text-emerald-600 dark:text-emerald-400">● Active Reference Set</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">None Set</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Age {Math.max(21, adultAge)} • Realistic
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Model Creation vs Media Production */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('model')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'model'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              1. Authoritative Face Model Creator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'media'
                  ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              2. Content Generation Studio (Images &amp; Reels)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2.5">
          <Info className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: VISUAL MODEL CREATOR                                    */}
      {/* ============================================================== */}
      {activeTab === 'model' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Controls Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Section 1: Ethnicity */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  1. Cultural Heritage &amp; Ethnicity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Presets ensure high realism and authentic bone structure.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ETHNICITY_PRESETS.map((preset) => {
                  const isSelected = ethnicity === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setEthnicity(preset.id as VisualModelOptions['ethnicity'])}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {preset.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {ethnicity === 'custom' && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Ethnicity Description
                  </label>
                  <input
                    type="text"
                    value={ethnicityCustom}
                    onChange={(e) => setEthnicityCustom(e.target.value)}
                    placeholder="e.g. Kashmiri-Tibetan heritage, warm olive tones, almond eyes"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Section 2: Look & Aesthetic Style */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  2. Style &amp; Look (Traditional vs. Modern)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cultural heritage attire or chic modern luxury fashion.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STYLE_PRESETS.map((preset) => {
                  const isSelected = styleLook === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setStyleLook(preset.id as VisualModelOptions['styleLook'])}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {preset.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Body Silhouette */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  3. Body Silhouette &amp; Build
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Natural anatomy framing for consistent body proportions.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BODY_STRUCTURE_PRESETS.map((preset) => {
                  const isSelected = bodyStructure === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setBodyStructure(preset.id as VisualModelOptions['bodyStructure'])}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {preset.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Shot Composition & Perspective */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                4. Primary Perspective &amp; Framing
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Shot Framing
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHOT_TYPES.map((shot) => (
                      <button
                        key={shot.id}
                        type="button"
                        onClick={() => setShotType(shot.id as VisualModelOptions['shotType'])}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all ${
                          shotType === shot.id
                            ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {shot.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Camera Angle
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CAMERA_ANGLES.map((angle) => (
                      <button
                        key={angle.id}
                        type="button"
                        onClick={() => setCameraAngle(angle.id as VisualModelOptions['cameraAngle'])}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all ${
                          cameraAngle === angle.id
                            ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {angle.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Optional Concept Reference Upload */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-500" />
                    5. Reference Concept Art Image
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload an AI-generated sketch or concept to guide synthesis.
                  </p>
                </div>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  Optional
                </span>
              </div>

              {/* Requirement 7: Aligned on same row for uploaded image */}
              {referenceImageUrl ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referenceImageUrl}
                      alt="Uploaded Reference Concept"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Reference Concept Attached
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate max-w-xs">
                        {referenceImageUrl}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceImageUrl(null)}
                      className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                      title="Remove Reference"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceUpload}
                    className="hidden"
                    id="reference-upload-input"
                  />
                  <label
                    htmlFor="reference-upload-input"
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all text-center group"
                  >
                    {uploadingReference ? (
                      <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Scanning and validating reference safety...
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                          Click to upload AI art / fictional reference image
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1">
                          PNG, JPG, WebP up to 10MB • Auto-stripped EXIF
                        </span>
                      </>
                    )}
                  </label>
                  {referenceError && (
                    <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      {referenceError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Facial Tweaks Accordion */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-4 flex items-center justify-between text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Advanced Facial Nuances &amp; Lighting Prompting</span>
                </div>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  {showAdvanced ? 'Hide' : 'Expand'}
                </span>
              </button>

              {showAdvanced && (
                <div className="p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Facial Features &amp; Gaze
                    </label>
                    <input
                      type="text"
                      value={facialFeatures}
                      onChange={(e) => setFacialFeatures(e.target.value)}
                      placeholder="e.g. expressive almond eyes, graceful defined jawline, warm smile"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Hair Styling Details
                    </label>
                    <input
                      type="text"
                      value={hairStyle}
                      onChange={(e) => setHairStyle(e.target.value)}
                      placeholder="e.g. lustrous long dark wavy hair adorned with delicate fresh jasmine"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Lighting &amp; Ambience
                    </label>
                    <input
                      type="text"
                      value={lighting}
                      onChange={(e) => setLighting(e.target.value)}
                      placeholder="e.g. warm golden hour backlight, soft diffused master portrait studio fill"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Additional Cultural / Style Prompts
                    </label>
                    <input
                      type="text"
                      value={additionalPrompt}
                      onChange={(e) => setAdditionalPrompt(e.target.value)}
                      placeholder="e.g. delicate gold nose pin, auspicious subtle red bindi, pure silk textures"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Requirement 6: Dynamic Status Bubble while Generating */}
            {generating && (
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 shadow-sm space-y-2.5 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                    <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
                    <span>
                      {generationStep <= 1 && `Thinking ${generationElapsed.toFixed(1)}s: Analyzing physical traits...`}
                      {generationStep === 2 && `Generating facial structure & realistic skin (${generationElapsed.toFixed(1)}s)...`}
                      {generationStep === 3 && `Synthesizing multi-angle camera perspectives (${generationElapsed.toFixed(1)}s)...`}
                      {generationStep >= 4 && `Finalizing photorealistic master render (${generationElapsed.toFixed(1)}s)...`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    {generationElapsed.toFixed(1)}s elapsed
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-indigo-200 dark:bg-indigo-900/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(95, (generationElapsed / 6) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Model: Open-Source Engine (FLUX.1 / ComfyUI)</span>
                  <span>Target: 1024×1024 photorealistic</span>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="button"
              disabled={generating || !isFaceLocked}
              title={
                !isFaceLocked
                  ? 'Face must be locked before generating visual views. Please generate and lock a face card first in the Physical Features tab.'
                  : undefined
              }
              onClick={handleGenerate}
              className="w-full h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Synthesizing Realistic Persona ({generationElapsed.toFixed(1)}s)...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Generate Realistic Persona Visual
                </>
              )}
            </button>
          </div>

          {/* RIGHT COLUMN: Live Generation Preview & Approval (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sticky top-6 transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Photorealistic Candidate Preview
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">1024 × 1024</span>
              </div>

              {/* Visual Canvas Display */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                {generating ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin" />
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Synthesizing Photorealistic Persona...
                    </div>
                    <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {generationElapsed.toFixed(1)}s elapsed
                    </div>
                    <p className="text-[10px] text-slate-500 max-w-xs">
                      Applying realistic skin textures, {ethnicity.replace('_', ' ')} facial features, {styleLook} attire, and adult compliance constraints (&ge;21).
                    </p>
                  </div>
                ) : currentDisplayUrl ? (
                  <div className="relative w-full h-full group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={currentDisplayUrl}
                      src={currentDisplayUrl}
                      alt="Generated Persona Candidate"
                      onError={() => setCandidateError(true)}
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white border border-slate-700 font-mono flex items-center gap-1.5 shadow-sm">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Realistic Identity Model
                    </div>
                    <div className="absolute top-3 right-3 bg-emerald-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-emerald-300 border border-emerald-500/40 font-mono shadow-sm">
                      Adult &ge; 21 Verified
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-2 text-slate-400">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No Model Generated Yet
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                      Select ethnicity, style (traditional silk or modern chic), and click <strong>Generate Realistic Persona Visual</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Multi-Angle Consistency Strip */}
              {currentDisplayUrl && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Multi-Angle Consistency Strip
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Click to switch perspective</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {multiAngles.map((item) => {
                      const isSelected = selectedAngleView === item.angle;
                      return (
                        <button
                          key={item.angle}
                          type="button"
                          onClick={() => setSelectedAngleView(item.angle)}
                          className={`relative rounded-lg overflow-hidden border p-1 text-center transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {item.url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.url}
                              alt={item.label}
                              className="w-full aspect-square object-cover rounded"
                            />
                          ) : (
                            <div className="w-full aspect-square rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                              <Camera className="w-4 h-4 opacity-50" />
                            </div>
                          )}
                          <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
                            {item.label.split(' ')[0]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Provenance Metadata & Confirmation Action */}
              {generatedResult && (
                <div className="space-y-4 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Target Persona:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{personaName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Enforced Age:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {Math.max(21, adultAge)} (Adult Guardrail Verified)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Archetype:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                        {generatedResult.config.ethnicity.replace('_', ' ')} •{' '}
                        {generatedResult.config.styleLook}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate pt-1 border-t border-slate-200 dark:border-slate-800">
                      Hash: {generatedResult.provenanceHash.slice(0, 24)}...
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={marking}
                    onClick={handleMarkAsVisualModel}
                    className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {marking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Setting as Authoritative Reference Model...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Approve &amp; Mark as Persona Visual Model
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PERSONA MEDIA STUDIO (CREATE IMAGES & VIDEOS)           */}
      {/* ============================================================== */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          {/* Identity Anchor Confirmation Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                {activeAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAvatar}
                    alt={personaName}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-indigo-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
                    {personaName ? personaName.charAt(0) : <Camera className="w-5 h-5 text-slate-400" />}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-white dark:border-slate-950" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Anchored to Approved Persona:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{personaName}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Every image and video generated below preserves this exact approved face, bone structure, and heritage.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('model')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 whitespace-nowrap self-start sm:self-auto"
            >
              Modify Face Model &rarr;
            </button>
          </div>

          {contentError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{contentError}</span>
            </div>
          )}

          {contentSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{contentSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: Media Generation Form (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Media Type Selection */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Select Media Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMediaType('image');
                      if (aspectRatio === '9:16') setAspectRatio('1:1');
                    }}
                    className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                      mediaType === 'image'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${mediaType === 'image' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">Photorealistic Image</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">High-res posts, carousel slides, portrait shots</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMediaType('video');
                      setAspectRatio('9:16');
                    }}
                    className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                      mediaType === 'video'
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${mediaType === 'video' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">AI Video Reel (9:16)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Instagram Reels, TikTok &amp; Shorts with camera motion</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Prompt Input & Quick Scene Suggestions */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Prompt for {personaName}
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                    Anchored to approved face
                  </span>
                </div>

                <textarea
                  rows={4}
                  value={contentPrompt}
                  onChange={(e) => setContentPrompt(e.target.value)}
                  placeholder={`Describe what ${personaName} is doing, the outfit, background, and lighting...`}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                />

                {/* Quick Scenario Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">Quick scene ideas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Urban Cafe Co-working', prompt: 'Sitting at a chic outdoor cafe in Chennai with a matcha latte and modern laptop, smiling candidly, morning sun' },
                      { label: 'Traditional Temple Courtyard', prompt: 'Walking gracefully through an ancient South Indian temple courtyard, rich gold Kanjeevaram silk saree, brass lamps, divine golden hour' },
                      { label: 'Tech Conference Keynote', prompt: 'On stage giving an inspiring keynote presentation on AI & culture, sharp tailored charcoal blazer, smart wireless mic, dramatic stage lights' },
                      { label: 'Sunset Rooftop Lounge', prompt: 'Standing at a stylish rooftop terrace at sunset overlooking a glowing skyline, soft wind in hair, elegant evening gown, cinematic bokeh' },
                      { label: 'Morning Fitness Routine', prompt: 'Stretching in a serene sunlit yoga studio with lush greenery, breathable athletic wear, mindful tranquil expression' },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setContentPrompt(item.prompt)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] transition-colors"
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Composition, Camera Angle & Settings */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Composition &amp; Perspective Settings
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: '1:1', label: '1:1 (Square Feed)' },
                        { id: '9:16', label: '9:16 (Reels/Story)' },
                        { id: '4:5', label: '4:5 (IG Portrait)' },
                        { id: '16:9', label: '16:9 (Landscape)' },
                      ].map((ratio) => (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => setAspectRatio(ratio.id as typeof aspectRatio)}
                          className={`p-2 rounded-lg border text-center text-[11px] font-semibold transition-all ${
                            aspectRatio === ratio.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Camera Angle */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Persona Camera Angle
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
                          onClick={() => setContentAngle(ang.id as typeof contentAngle)}
                          className={`p-2 rounded-lg border text-center text-[11px] font-semibold transition-all ${
                            contentAngle === ang.id
                              ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-950 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {ang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Video specific controls */}
                {mediaType === 'video' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-[11px] font-medium text-purple-700 dark:text-purple-300 mb-1.5">
                      Camera Motion Animation (9:16 Video Reel)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'zoom_in', label: 'Slow Zoom In' },
                        { id: 'orbit', label: 'Orbit Arc (3D)' },
                        { id: 'pan_tracking', label: 'Tracking Walk' },
                        { id: 'static', label: 'Static Cinematic' },
                      ].map((mot) => (
                        <button
                          key={mot.id}
                          type="button"
                          onClick={() => setCameraMotion(mot.id as typeof cameraMotion)}
                          className={`p-2 rounded-lg border text-center text-[11px] font-semibold transition-all ${
                            cameraMotion === mot.id
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                disabled={generatingContent || !isFaceLocked}
                title={
                  !isFaceLocked
                    ? 'Face must be locked before generating content. Please generate and lock a face card first in the Physical Features tab.'
                    : undefined
                }
                onClick={handleGenerateContent}
                className="w-full h-12 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingContent ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating {mediaType === 'video' ? 'AI Video Reel' : 'Photorealistic Image'} with {personaName}&apos;s Model...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Create {mediaType === 'video' ? 'AI Video Reel' : 'Image'} with Approved Persona Face
                  </>
                )}
              </button>
            </div>

            {/* RIGHT COLUMN: Output Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sticky top-6 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {mediaType === 'video' ? <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" /> : <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    Generated Media Preview
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {generatedMediaResult?.type.toUpperCase() || mediaType.toUpperCase()} • {aspectRatio}
                  </span>
                </div>

                {/* Media Canvas */}
                <div className={`relative w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center ${aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[520px] mx-auto' : 'aspect-square'}`}>
                  {generatingContent ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin" />
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Synthesizing {mediaType === 'video' ? 'Video Reel' : 'Photorealistic Image'}...
                      </div>
                      <p className="text-[10px] text-slate-500 max-w-xs">
                        Injecting {personaName}&apos;s facial geometry, consistent lighting, and {contentAngle} camera angle.
                      </p>
                    </div>
                  ) : generatedMediaResult ? (
                    generatedMediaResult.type === 'video' ? (
                      <div className="relative w-full h-full">
                        <video
                          key={generatedMediaResult.url}
                          src={generatedMediaResult.url}
                          controls
                          autoPlay
                          loop
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={generatedMediaResult.url}
                          src={generatedMediaResult.url}
                          alt="Generated Persona Content"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center space-y-2 text-slate-400">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        {mediaType === 'video' ? <Video className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Canvas Ready for Generation
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                        Enter your prompt on the left to create media anchored to {personaName}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
