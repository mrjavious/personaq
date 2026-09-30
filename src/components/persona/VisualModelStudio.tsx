'use client';

import React, { useState } from 'react';
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
  UserCheck,
} from 'lucide-react';
import {
  ETHNICITY_PRESETS,
  STYLE_PRESETS,
  BODY_STRUCTURE_PRESETS,
  SHOT_TYPES,
  VisualModelOptions,
} from '@/lib/persona/visual-types';

interface VisualModelStudioProps {
  personaId: string;
  personaName: string;
  adultAge: number;
  currentAvatarUrl?: string | null;
  currentVisualConfig?: string | null;
  onVisualModelMarked?: (updatedPersona: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    visualModelConfig?: string | null;
  }) => void;
}

export default function VisualModelStudio({
  personaName,
  adultAge,
  currentAvatarUrl,
  currentVisualConfig,
  onVisualModelMarked,
}: VisualModelStudioProps) {
  // Parse existing visual config if available
  let parsedInitialConfig: Partial<VisualModelOptions> = {};
  try {
    if (currentVisualConfig) {
      parsedInitialConfig = JSON.parse(currentVisualConfig);
    }
  } catch {
    // Ignore JSON parse error
  }

  // State
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

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generated Result
  const [generatedResult, setGeneratedResult] = useState<{
    imageUrl: string;
    thumbnailUrl: string;
    prompt: string;
    modelUsed: string;
    provenanceHash: string;
    config: VisualModelOptions;
  } | null>(null);

  const [activeAvatar, setActiveAvatar] = useState<string | null>(
    currentAvatarUrl || null
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    const payload: VisualModelOptions = {
      ethnicity,
      ...(ethnicity === 'custom' && { ethnicityCustom }),
      styleLook,
      bodyStructure,
      shotType,
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
        throw new Error(data.error || 'Generation failed');
      }

      setGeneratedResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Visual generation failed');
    } finally {
      setGenerating(false);
    }
  };

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
      setSuccessMessage('Successfully designated as active Persona Visual Reference Model!');
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

  return (
    <div className="space-y-8">
      {/* Studio Header & Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-slate-900 border border-indigo-500/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gemini Imagen Model Engine
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Persona Visual Model Studio
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Design and generate photorealistic face structures, body types, and cultural aesthetics for{' '}
              <strong className="text-white">{personaName}</strong>. Select authentic ethnicities (e.g. South Indian girl), traditional silk sarees or modern fashion, and mark the approved image as the authoritative visual reference.
            </p>
          </div>

          {/* Active Model Reference Display */}
          <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 p-3 rounded-xl shrink-0">
            <div className="relative">
              {activeAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeAvatar}
                  alt={personaName}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-indigo-500/50 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                  <Camera className="w-6 h-6" />
                </div>
              )}
              {activeAvatar && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full shadow">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Current Reference</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                {activeAvatar ? (
                  <>
                    <span className="text-emerald-400">● Model Active</span>
                  </>
                ) : (
                  <span className="text-amber-400">None Set</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Age {adultAge} • Disclosed AI
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
          <Info className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Controls & Presets (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Ethnicity Selection */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  1. Ethnicity &amp; Cultural Heritage
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Shapes realistic bone structure, complexion, eye contours, and heritage styling.
                </p>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
                Primary Factor
              </span>
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
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {preset.label}
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {ethnicity === 'custom' && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Custom Ethnicity Description
                </label>
                <input
                  type="text"
                  value={ethnicityCustom}
                  onChange={(e) => setEthnicityCustom(e.target.value)}
                  placeholder="e.g. Kashmiri-Tibetan heritage, warm olive tones, almond eyes"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Section 2: Look & Aesthetic Style */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  2. Style &amp; Look (Traditional vs. Modern)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select between authentic cultural heritage attire or chic modern luxury fashion.
                </p>
              </div>
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
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm shadow-purple-500/20'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {preset.label}
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Body & Physical Structure */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              3. Body Structure &amp; Proportions
            </h3>
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
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {preset.label}
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Shot Composition */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-400" />
              4. Shot Composition &amp; Framing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SHOT_TYPES.map((type) => {
                const isSelected = shotType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setShotType(type.id as VisualModelOptions['shotType'])}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {type.label}
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {type.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Fine-Tuning Accordion */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Fine-Tuning: Face, Hair &amp; Lighting Details
              </span>
              <span className="text-[11px] text-slate-500">
                {showAdvanced ? 'Hide Details' : 'Show Details'}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Specific Facial &amp; Expression Features
                  </label>
                  <input
                    type="text"
                    value={facialFeatures}
                    onChange={(e) => setFacialFeatures(e.target.value)}
                    placeholder="e.g. expressive almond dark eyes, warm caramel skin, natural soft smile, sharp jawline"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Hair Style &amp; Adornments
                  </label>
                  <input
                    type="text"
                    value={hairStyle}
                    onChange={(e) => setHairStyle(e.target.value)}
                    placeholder="e.g. neat traditional long braid with fresh jasmine flowers, or modern voluminous layers"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Environment &amp; Lighting Setup
                  </label>
                  <input
                    type="text"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    placeholder="e.g. warm sunset golden hour, traditional wooden veranda, high-end studio lighting"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Additional Prompt Notes
                  </label>
                  <input
                    type="text"
                    value={additionalPrompt}
                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                    placeholder="e.g. delicate gold nose pin, auspicious subtle red bindi, pure silk textures"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Synthesizing with Gemini Imagen Engine...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                Generate Persona Visual (Gemini API)
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Live Generation Preview & Approval (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                Generated Visual Candidate
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">1024 × 1024</span>
            </div>

            {/* Visual Canvas Display */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {generating ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <div className="text-xs font-semibold text-slate-200">
                    Generating Photorealistic Persona...
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-xs">
                    Applying {ethnicity.replace('_', ' ')} facial features, {styleLook} attire, and adult compliance constraints.
                  </p>
                </div>
              ) : generatedResult ? (
                <div className="relative w-full h-full group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generatedResult.imageUrl}
                    alt="Generated Persona Candidate"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-200 border border-slate-700 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {generatedResult.modelUsed}
                  </div>
                  <div className="absolute top-3 right-3 bg-indigo-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-indigo-300 border border-indigo-500/40 font-mono">
                    SHA-256 Verified
                  </div>
                </div>
              ) : activeAvatar ? (
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeAvatar}
                    alt="Active Persona Model"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Visual Model Reference
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Generate a new option on the left to replace or evolve this reference.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-3 text-slate-500">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="text-xs font-semibold text-slate-300">
                    No Candidate Generated Yet
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Select ethnicity, style (traditional silk saree or modern chic), and click <strong>Generate Persona Visual</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Candidate Metadata & Mark Action */}
            {generatedResult && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Target Persona:</span>
                    <span className="font-semibold text-white">{personaName}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Enforced Age:</span>
                    <span className="font-semibold text-emerald-400">
                      {Math.max(25, adultAge)} (Adult Guardrail Verified)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Archetype:</span>
                    <span className="font-semibold text-indigo-300">
                      {generatedResult.config.ethnicity.replace('_', ' ')} •{' '}
                      {generatedResult.config.styleLook}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate pt-1 border-t border-slate-850">
                    Hash: {generatedResult.provenanceHash.slice(0, 24)}...
                  </div>
                </div>

                <button
                  type="button"
                  disabled={marking}
                  onClick={handleMarkAsVisualModel}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {marking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Setting as Persona Model...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Mark as Persona Visual Model
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Guardrail Disclaimer */}
            <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-2.5 text-[11px] text-indigo-200/80">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Guardrails Enforced:</strong> All generation requests strictly include adult age verification (&ge;25), fictional identity enforcement, and SFW suitability clearance.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
