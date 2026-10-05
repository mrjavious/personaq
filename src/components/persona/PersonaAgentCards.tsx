'use client';

import React, { useState } from 'react';
import {
  Smile,
  Eye,
  Sparkles,
  ShieldCheck,
  Check,
  Palette,
  PenTool,
  Scissors,
  Save,
  CheckCircle2,
  Sliders,
  Camera,
  RefreshCw,
  Activity,
  Globe,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import {
  VisualModelOptions,
  ETHNICITY_PRESETS,
  FACE_JAWLINE_PRESETS,
  FACE_EYE_PRESETS,
  FACE_NOSE_PRESETS,
  FACE_LIPS_PRESETS,
  DIMPLE_PRESETS,
  SKIN_COMPLEXION_PRESETS,
  DISTINCTIVE_MARKS_PRESETS,
  BODY_STRUCTURE_PRESETS,
  UPPER_BODY_BUST_PRESETS,
  LOWER_BODY_HIP_PRESETS,
  TATTOO_STYLE_PRESETS,
  TATTOO_PLACEMENT_PRESETS,
  formatPhysicalDNASummary,
  getPersonaMultiAnglePackClient,
  PersonaAngleItem,
} from '@/lib/persona/visual-types';

interface PersonaAgentCardsProps {
  initialConfig?: string | null;
  initialAvatarUrl?: string | null;
  initialFaceStatus?: string | null;
  personaName?: string;
  adultAge?: number;
  personaId?: string;
  onSaveDna: (updatedConfig: VisualModelOptions, summaryText: string) => Promise<void>;
  onModelApproved?: (updatedPersona: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    visualModelConfig?: string | null;
  }) => void;
  isSaving?: boolean;
}

type AngleItem = PersonaAngleItem;

export default function PersonaAgentCards({
  initialConfig,
  initialAvatarUrl,
  initialFaceStatus,
  personaName = 'Priya sweety',
  adultAge = 21,
  personaId,
  onSaveDna,
  onModelApproved,
  isSaving = false,
}: PersonaAgentCardsProps) {
  // Parse initial config
  let parsed: Partial<VisualModelOptions> = {};
  try {
    if (initialConfig) {
      parsed = JSON.parse(initialConfig);
    }
  } catch {
    // Ignore JSON parse error
  }

  // Active Category Tab
  const [activeCategory, setActiveCategory] = useState<
    'origin' | 'face' | 'dimples' | 'skin' | 'moles' | 'body' | 'tattoos' | 'hair'
  >('origin');

  // Preview Mode: Photorealistic Rendering vs Anatomical Blueprint
  const [previewMode, setPreviewMode] = useState<'render' | 'blueprint'>('render');

  // Ethnicity, Style Archetype & Shot Type
  const inferDefaultEthnicity = (name: string): VisualModelOptions['ethnicity'] => {
    const lower = name.toLowerCase();
    if (lower.includes('elena') || lower.includes('vance') || lower.includes('sophie') || lower.includes('emma')) {
      return 'caucasian';
    }
    return 'south_indian';
  };

  const defaultInitEth = parsed.ethnicity || inferDefaultEthnicity(personaName);
  const defaultInitStyle = (parsed.styleLook as VisualModelOptions['styleLook']) || 'minimal_studio';
  const defaultInitPack = getPersonaMultiAnglePackClient(
    defaultInitEth,
    personaId,
    defaultInitStyle,
    initialAvatarUrl
  );

  const [ethnicity, setEthnicity] = useState<VisualModelOptions['ethnicity']>(defaultInitEth);
  const [styleLook] = useState<VisualModelOptions['styleLook']>(defaultInitStyle);
  const [shotType] = useState<VisualModelOptions['shotType']>(
    parsed.shotType || 'portrait'
  );

  // Modular State
  const [jawline, setJawline] = useState(parsed.faceCard?.jawline || 'soft_oval');
  const [eyeShape, setEyeShape] = useState(parsed.faceCard?.eyeShape || 'almond_expressive');
  const [noseBridge, setNoseBridge] = useState(parsed.faceCard?.noseBridge || 'refined_straight');
  const [lipFullness, setLipFullness] = useState(parsed.faceCard?.lipFullness || 'natural_soft');

  const [dimpleType, setDimpleType] = useState(parsed.dimple?.type || 'none');
  const [dimpleDepth, setDimpleDepth] = useState(parsed.dimple?.depth || 'subtle');

  const [complexion, setComplexion] = useState(parsed.skinTone?.complexion || 'warm_caramel');
  const [undertone, setUndertone] = useState(parsed.skinTone?.undertone || 'warm_golden');
  const [finish, setFinish] = useState(parsed.skinTone?.finish || 'dewy_glow');

  const [moleLocation, setMoleLocation] = useState(parsed.distinctiveMarks?.moles || 'none');
  const [freckles, setFreckles] = useState(parsed.distinctiveMarks?.freckles || 'none');
  const [customMark, setCustomMark] = useState(parsed.distinctiveMarks?.customMark || '');

  const [silhouette, setSilhouette] = useState(parsed.bodyProportions?.silhouette || 'hourglass');
  const [upperBodyBust, setUpperBodyBust] = useState(parsed.bodyProportions?.upperBodyBust || 'moderate');
  const [lowerBodyHip, setLowerBodyHip] = useState(parsed.bodyProportions?.lowerBodyHip || 'balanced');
  const [heightStance, setHeightStance] = useState(parsed.bodyProportions?.heightStance || 'balanced');

  const [tattooStyle, setTattooStyle] = useState(parsed.tattoos?.style || 'none');
  const [tattooPlacement, setTattooPlacement] = useState(parsed.tattoos?.placement || 'none');
  const [tattooDescription, setTattooDescription] = useState(parsed.tattoos?.description || '');

  const [hairTexture, setHairTexture] = useState(parsed.hairStyling?.texture || 'silky_straight');
  const [hairLength, setHairLength] = useState(parsed.hairStyling?.length || 'waist_long');
  const [hairAccents, setHairAccents] = useState(parsed.hairStyling?.accents || 'modern_clean');

  const [isFaceLocked, setIsFaceLocked] = useState(Boolean(parsed.isFaceLocked || initialFaceStatus === 'locked'));
  const [faceStatus, setFaceStatus] = useState<string>(
    initialFaceStatus || (parsed.isFaceLocked ? 'locked' : 'none')
  );
  const [candidateAsset, setCandidateAsset] = useState<{ id: string; url: string } | null>(null);
  const [isGeneratingFaceCard, setIsGeneratingFaceCard] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [isLockingFace, setIsLockingFace] = useState(false);
  const [isUploadingCandidate, setIsUploadingCandidate] = useState(false);
  const candidateFileInputRef = React.useRef<HTMLInputElement>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Live Visual Preview & Synthesis State (always populated with all 5 default multi-angles)
  const [activePreviewUrl, setActivePreviewUrl] = useState<string>(
    defaultInitPack[0]?.url || initialAvatarUrl || ''
  );
  const [selectedAngleView, setSelectedAngleView] = useState<string>('front');
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesizingAngle, setSynthesizingAngle] = useState<string | null>(null);
  const [pendingAngles, setPendingAngles] = useState<string[]>([]);
  const [completedAngles, setCompletedAngles] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSuccess, setPreviewSuccess] = useState<string | null>(null);

  const [multiAngles, setMultiAngles] = useState<AngleItem[]>(defaultInitPack);

  // Ethnicity change handler
  const handleEthnicityChange = (newEth: VisualModelOptions['ethnicity']) => {
    setEthnicity(newEth);
    const pack = getPersonaMultiAnglePackClient(
      newEth,
      isFaceLocked ? personaId : undefined,
      styleLook,
      isFaceLocked ? initialAvatarUrl : null
    );
    setMultiAngles(pack);
    if (!isFaceLocked) {
      const activeAngle = pack.find((p) => p.angle === selectedAngleView) || pack[0];
      if (activeAngle) {
        setActivePreviewUrl(activeAngle.url);
      }
    }
  };

  // Compile full options payload
  const currentOptions: VisualModelOptions = {
    ethnicity,
    styleLook,
    bodyStructure: (silhouette as VisualModelOptions['bodyStructure']) || 'hourglass',
    shotType,
    cameraAngle: (selectedAngleView as VisualModelOptions['cameraAngle']) || 'front',
    faceCard: {
      jawline,
      eyeShape,
      noseBridge,
      lipFullness,
      facialSymmetry: 'high_definition',
    },
    dimple: {
      type: dimpleType,
      depth: dimpleDepth,
    },
    skinTone: {
      complexion,
      undertone,
      finish,
    },
    distinctiveMarks: {
      moles: moleLocation,
      freckles,
      customMark,
    },
    bodyProportions: {
      silhouette,
      upperBodyBust,
      lowerBodyHip,
      heightStance,
    },
    tattoos: {
      style: tattooStyle,
      placement: tattooPlacement,
      description: tattooDescription,
    },
    hairStyling: {
      texture: hairTexture,
      length: hairLength,
      accents: hairAccents,
    },
    isFaceLocked,
    lockedFaceUrl: isFaceLocked ? (parsed.lockedFaceUrl || `/uploads/personas/${personaId}/locked_face.jpg`) : undefined,
  };

  // Lock and Save Physical Profile
  const handleSave = async () => {
    const summary = formatPhysicalDNASummary(currentOptions);
    await onSaveDna(currentOptions, summary);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Synthesize Live Preview (Sequential Multi-Angle Pipeline with Live Card Animation)
  const handleSynthesizePreview = async () => {
    if (!isFaceLocked && faceStatus !== 'locked') {
      setPreviewError('Face must be locked before generating multi-angle views. Generate and lock a face card first.');
      return;
    }
    setSynthesizing(true);
    setPreviewError(null);
    setPreviewSuccess(null);
    setCompletedAngles([]);

    const sequence: { angle: string; label: string }[] = [
      { angle: 'front', label: 'Front' },
      { angle: 'side', label: 'Side' },
      { angle: 'full_body', label: 'Full view' },
      { angle: 'full_back', label: 'Full Back view' },
      { angle: 'full_side', label: 'Full Side view' },
    ];

    setPendingAngles(['side', 'full_body', 'full_back', 'full_side']);

    try {
      for (let i = 0; i < sequence.length; i++) {
        const item = sequence[i];
        setSynthesizingAngle(item.angle);
        setPendingAngles(sequence.slice(i + 1).map((s) => s.angle));

        const res = await fetch('/api/persona/generate-visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...currentOptions,
            cameraAngle: item.angle,
            personaId,
            personaName,
            adultAge,
            referenceImageUrl: undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to synthesize ${item.label}`);
        }

        const freshUrl = data.imageUrl
          ? (data.imageUrl.includes('?') ? data.imageUrl : `${data.imageUrl}?t=${Date.now()}`)
          : '';

        // Immediately update this angle's card URL in multiAngles
        setMultiAngles((prev) =>
          prev.map((angleObj) =>
            angleObj.angle === item.angle ? { ...angleObj, url: freshUrl } : angleObj
          )
        );

        // If front or currently selected view, update active preview
        if (item.angle === 'front' || selectedAngleView === item.angle) {
          setActivePreviewUrl(freshUrl);
        }

        setCompletedAngles((prev) => [...prev, item.angle]);
      }

      setPreviewSuccess('All 5 perspectives synthesized with selected traits & verified consistent!');
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : 'Preview generation failed');
    } finally {
      setSynthesizing(false);
      setSynthesizingAngle(null);
      setPendingAngles([]);
    }
  };

  // Approve Preview as Visual Model Reference
  const handleApproveModel = async () => {
    setApproving(true);
    setPreviewError(null);

    try {
      const res = await fetch('/api/persona/mark-visual-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          imageUrl: activePreviewUrl.split('?')[0],
          config: currentOptions,
          prompt: `Authoritative reference model for ${personaName} with verified physical appearance`,
          modelUsed: 'opensource-visual-pipeline',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to set reference model');
      }

      setPreviewSuccess(`Successfully locked this appearance as ${personaName}'s active model!`);
      if (onModelApproved) {
        onModelApproved(data.persona);
      }
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  // Generate Face Card Candidate Sheet
  const handleGenerateFaceCard = async () => {
    setIsGeneratingFaceCard(true);
    setPreviewError(null);
    setPreviewSuccess(null);

    try {
      const res = await fetch('/api/persona/face-card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          traits: currentOptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate face card candidate');
      }

      setCandidateAsset(data.asset);
      setActivePreviewUrl(data.asset.url);
      setFaceStatus('draft');
      setPreviewSuccess(
        'Generated two-panel character reference sheet on seamless pure white background (#FFFFFF)! Left: tight face close-up, Right: full-body front view. Click "Lock Face Card" below to crop into authoritative anchors.'
      );
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Face card candidate generation failed';
      setPreviewError(msg);
    } finally {
      setIsGeneratingFaceCard(false);
    }
  };

  // Upload custom candidate sheet or portrait
  const handleUploadCandidateSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personaId) return;

    setIsUploadingCandidate(true);
    setPreviewError(null);
    setPreviewSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('personaId', personaId);

      const res = await fetch('/api/persona/face-card/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload face card candidate');
      }

      setCandidateAsset(data.asset);
      setActivePreviewUrl(data.asset.url);
      setFaceStatus('draft');
      setPreviewSuccess(
        `Uploaded face card reference sheet successfully! Click "Lock Face Card" below to crop into authoritative face & body anchors.`
      );
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingCandidate(false);
      if (candidateFileInputRef.current) {
        candidateFileInputRef.current.value = '';
      }
    }
  };

  // Lock Face Card (crops server-side with sharp into face and body anchors)
  const handleLockFace = async () => {
    if (!candidateAsset?.id) {
      setPreviewError('Please generate a face card candidate first before locking.');
      return;
    }

    setIsLockingFace(true);
    setPreviewError(null);
    setPreviewSuccess(null);

    try {
      const res = await fetch('/api/persona/face-card/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          assetId: candidateAsset.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to lock face card');
      }

      setIsFaceLocked(true);
      setFaceStatus('locked');
      setCandidateAsset(null);
      const lockedUrl = data.faceAsset?.url || data.persona?.avatarUrl || activePreviewUrl;
      setActivePreviewUrl(lockedUrl);
      setMultiAngles((prev) =>
        prev.map((item) => (item.angle === 'front' ? { ...item, url: lockedUrl } : item))
      );
      setPreviewSuccess(
        `Face card permanently locked to ${personaName}. Cropped into authoritative face and body anchors. Perspective views and content generation are now enabled!`
      );
      if (onModelApproved && data.persona) {
        onModelApproved(data.persona);
      }
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : 'Lock face failed');
    } finally {
      setIsLockingFace(false);
    }
  };

  // Confirm replacement of locked face
  const handleConfirmReplaceFace = () => {
    setShowReplaceModal(false);
    handleGenerateFaceCard();
  };

  // Skin swatch colors
  const skinColorMap: Record<string, string> = {
    warm_caramel: '#c68a4c',
    olive_wheatish: '#c29b68',
    golden_bronze: '#b87d4b',
    deep_melanin: '#5b341f',
    fair_porcelain: '#f5d0be',
    sunset_honey: '#d49b6a',
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold mb-1 border border-indigo-200 dark:border-indigo-800/50">
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Physical Features &amp; Appearance
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Physical Breakdown &amp; Modular Features
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Configure individual traits (Face Card, Dimples, Skin Tone, Moles, Body Curves, Tattoos, Hair) with a real-time visual preview canvas and anatomical mapping.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-2 shrink-0 self-start md:self-auto disabled:opacity-50"
        >
          {isSaving ? (
            'Saving Profile...'
          ) : savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              Profile Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Lock Appearance Profile
            </>
          )}
        </button>
      </div>

      {previewError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{previewError}</span>
        </div>
      )}

      {previewSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{previewSuccess}</span>
        </div>
      )}

      {/* Trait Category Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
        {[
          { id: 'origin', label: 'Origin & Style', icon: Globe, summary: `${ethnicity.replace(/_/g, ' ')} • ${styleLook}` },
          { id: 'face', label: 'Face Card', icon: Eye, summary: `${jawline} • ${eyeShape}` },
          { id: 'dimples', label: 'Dimples & Nuances', icon: Smile, summary: dimpleType !== 'none' ? `${dimpleType}` : 'None' },
          { id: 'skin', label: 'Skin & Complexion', icon: Palette, summary: `${complexion}` },
          { id: 'moles', label: 'Moles & Marks', icon: Sparkles, summary: moleLocation !== 'none' ? `${moleLocation}` : 'Clean' },
          { id: 'body', label: 'Body Curves & Silhouette', icon: ShieldCheck, summary: `${silhouette} • ${upperBodyBust}` },
          { id: 'tattoos', label: 'Tattoos & Body Art', icon: PenTool, summary: tattooStyle !== 'none' ? `${tattooStyle}` : 'None' },
          { id: 'hair', label: 'Hair & Styling', icon: Scissors, summary: `${hairTexture} • ${hairLength}` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id as typeof activeCategory)}
              className={`flex-1 min-w-[130px] p-2.5 rounded-lg text-left transition-all border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </div>
              <div className="text-[10px] opacity-75 truncate mt-0.5 capitalize">
                {tab.summary.replace(/_/g, ' ')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Category Content Area with Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Controls for Active Category (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
          {/* 0. ORIGIN & STYLE ARCHETYPE */}
          {activeCategory === 'origin' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Origin, Ethnicity &amp; Visual Archetype
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select the cultural and ethnic background for this persona agent.
                </p>
              </div>

              {/* Ethnicity Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Cultural / Ethnic Heritage
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ETHNICITY_PRESETS.filter((e) => e.id !== 'custom').map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleEthnicityChange(p.id as typeof ethnicity)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        ethnicity === p.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {p.label}
                        {ethnicity === p.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1. FACE CARD */}
          {activeCategory === 'face' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Face Card Architecture
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shapes the facial structure, eye geometry, nose bridge, and lip contours.
                </p>
              </div>

              {/* Jawline */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Jawline Contour</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FACE_JAWLINE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setJawline(p.id as typeof jawline)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        jawline === p.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {p.label}
                        {jawline === p.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Eyes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Eye Shape &amp; Gaze</label>
                <div className="grid grid-cols-2 gap-2">
                  {FACE_EYE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEyeShape(p.id as typeof eyeShape)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        eyeShape === p.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {p.label}
                        {eyeShape === p.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nose & Lips in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Nose Bridge</label>
                  <div className="space-y-1.5">
                    {FACE_NOSE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNoseBridge(p.id as typeof noseBridge)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          noseBridge === p.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{p.label}</span>
                        {noseBridge === p.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Lip Fullness</label>
                  <div className="space-y-1.5">
                    {FACE_LIPS_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLipFullness(p.id as typeof lipFullness)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          lipFullness === p.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{p.label}</span>
                        {lipFullness === p.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. DIMPLES & FACIAL NUANCES */}
          {activeCategory === 'dimples' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smile className="w-4 h-4 text-amber-500" />
                  Dimple Customization &amp; Smile Nuances
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Add signature cheek dimples, chin clefts, or warm smile lines to give the face unforgettable character.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DIMPLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDimpleType(p.id as typeof dimpleType)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      dimpleType === p.id
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-white font-medium'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {p.label}
                      {dimpleType === p.id && <Check className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{p.desc}</div>
                  </button>
                ))}
              </div>

              {dimpleType !== 'none' && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Dimple Depth</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'subtle', label: 'Subtle Natural', desc: 'Appears delicately with gentle smiling' },
                      { id: 'pronounced', label: 'Deep & Pronounced', desc: 'Prominent signature deep dimples' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDimpleDepth(d.id as typeof dimpleDepth)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          dimpleDepth === d.id
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-white font-medium'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{d.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. SKIN TONE & COMPLEXION */}
          {activeCategory === 'skin' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-500" />
                  Skin Tone, Undertones &amp; Texture Finish
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Controls pigmentation warmth, undertone balance, and natural photorealistic pore finish.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {SKIN_COMPLEXION_PRESETS.map((p) => {
                  const swatchColor = skinColorMap[p.id] || '#c68a4c';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setComplexion(p.id as typeof complexion)}
                      className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                        complexion === p.id
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/30 shrink-0 shadow-xs"
                          style={{ backgroundColor: swatchColor }}
                        />
                        <span className="text-xs font-semibold flex-1 truncate">{p.label}</span>
                        {complexion === p.id && <Check className="w-3 h-3 text-purple-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500">{p.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Undertone</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'warm_golden', label: 'Warm Golden' },
                      { id: 'cool_rosy', label: 'Cool Rosy' },
                      { id: 'neutral_olive', label: 'Neutral Olive' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUndertone(u.id as typeof undertone)}
                        className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                          undertone === u.id
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Skin Finish</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dewy_glow', label: 'Dewy Glow' },
                      { id: 'matte', label: 'Velvet Matte' },
                      { id: 'luminous', label: 'Sun-Kissed' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFinish(f.id as typeof finish)}
                        className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                          finish === f.id
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DISTINCTIVE MARKS & MOLES */}
          {activeCategory === 'moles' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Distinctive Marks, Moles &amp; Beauty Spots
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permanent signature beauty spots or subtle freckles that make the persona instantly recognizable.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {DISTINCTIVE_MARKS_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMoleLocation(p.id as typeof moleLocation)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      moleLocation === p.id
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-white font-medium'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {p.label}
                      {moleLocation === p.id && <Check className="w-3 h-3 text-rose-500" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{p.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Freckles Distribution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'None' },
                      { id: 'subtle_nose', label: 'Nose Bridge' },
                      { id: 'cheek_dusting', label: 'Cheek Dusting' },
                    ].map((fr) => (
                      <button
                        key={fr.id}
                        type="button"
                        onClick={() => setFreckles(fr.id as typeof freckles)}
                        className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                          freckles === fr.id
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {fr.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Custom Marking Description</label>
                  <input
                    type="text"
                    value={customMark}
                    onChange={(e) => setCustomMark(e.target.value)}
                    placeholder="e.g. tiny heart-shaped mark above left collarbone"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. BODY SILHOUETTE & CURVES */}
          {activeCategory === 'body' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Body Silhouette &amp; Proportions
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure natural curves, bust and hip framing, and overall body silhouette proportions.
                </p>
              </div>

              {/* Silhouette Preset */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Overall Silhouette Architecture</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {BODY_STRUCTURE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSilhouette(p.id as typeof silhouette)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        silhouette === p.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white font-medium'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        {p.label}
                        {silhouette === p.id && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upper Body / Bust & Lower Body / Hip Proportions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Upper Body / Bust Proportion
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {UPPER_BODY_BUST_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setUpperBodyBust(p.id as typeof upperBodyBust)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          upperBodyBust === p.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{p.label}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Lower Body / Hip &amp; Silhouette Curve
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOWER_BODY_HIP_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLowerBodyHip(p.id as typeof lowerBodyHip)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          lowerBodyHip === p.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{p.label}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Height & Stance */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Height &amp; Stance</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'petite', label: 'Petite (~5’2”)', desc: 'Compact delicate frame' },
                    { id: 'balanced', label: 'Balanced (~5’5”)', desc: 'Natural classic height' },
                    { id: 'statuesque', label: 'Statuesque (~5’9”+)', desc: 'Runway model height' },
                  ].map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHeightStance(h.id as typeof heightStance)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        heightStance === h.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold">{h.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{h.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. TATTOOS & BODY ART */}
          {activeCategory === 'tattoos' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Tattoos &amp; Body Art
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Incorporate tasteful fine-line tattoos, floral motifs, or sacred geometry into the persona.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {TATTOO_STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTattooStyle(p.id as typeof tattooStyle)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tattooStyle === p.id
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-950 dark:text-white font-medium'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {p.label}
                      {tattooStyle === p.id && <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{p.desc}</div>
                  </button>
                ))}
              </div>

              {tattooStyle !== 'none' && (
                <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Tattoo Placement</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {TATTOO_PLACEMENT_PRESETS.filter((p) => p.id !== 'none').map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTattooPlacement(p.id as typeof tattooPlacement)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            tattooPlacement === p.id
                              ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-950 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <div className="text-xs font-semibold flex items-center justify-between gap-1">
                            <span className="truncate">{p.label}</span>
                            {tattooPlacement === p.id && <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Art Motif &amp; Description
                    </label>
                    <input
                      type="text"
                      value={tattooDescription}
                      onChange={(e) => setTattooDescription(e.target.value)}
                      placeholder="e.g. delicate botanical wildflower sprig with fine leaves"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. HAIR & CULTURAL STYLING */}
          {activeCategory === 'hair' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-pink-500" />
                  Hair Styling &amp; Cultural Accents
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hair length, natural texture, and authentic adornments (fresh jasmine gajra or modern minimalist pins).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Texture</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'silky_straight', label: 'Silky Straight' },
                      { id: 'loose_waves', label: 'Soft Loose Waves' },
                      { id: 'lustrous_curls', label: 'Lustrous Curls' },
                      { id: 'textured_coily', label: 'Textured Coils' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setHairTexture(t.id as typeof hairTexture)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          hairTexture === t.id
                            ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{t.label}</span>
                        {hairTexture === t.id && <Check className="w-3 h-3 text-pink-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Length</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'waist_long', label: 'Waist Long' },
                      { id: 'mid_back', label: 'Mid-Back Length' },
                      { id: 'shoulder_length', label: 'Shoulder Length' },
                      { id: 'chic_bob', label: 'Chic Blunt Bob' },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setHairLength(l.id as typeof hairLength)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          hairLength === l.id
                            ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{l.label}</span>
                        {hairLength === l.id && <Check className="w-3 h-3 text-pink-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Cultural Adornment</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'jasmine_gajra', label: 'Fresh Jasmine Gajra' },
                      { id: 'gold_hairpins', label: 'Delicate Gold Pins' },
                      { id: 'modern_clean', label: 'Modern Clean Unadorned' },
                    ].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setHairAccents(a.id as typeof hairAccents)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          hairAccents === a.id
                            ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{a.label}</span>
                        {hairAccents === a.id && <Check className="w-3 h-3 text-pink-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Visual Preview & Anatomical Map (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sticky top-6 transition-colors">
            {/* Preview Mode Switcher */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewMode('render')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    previewMode === 'render'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  Live Render Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('blueprint')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    previewMode === 'blueprint'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  Anatomical Map
                </button>
              </div>

              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {previewMode === 'render' ? '1024 × 1024' : 'Blueprint'}
              </span>
            </div>

            {/* PREVIEW DISPLAY 1: PHOTOREALISTIC LIVE RENDER */}
            {previewMode === 'render' && (
              <div className="space-y-3">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  {synthesizing ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin" />
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Synthesizing Physical Features...
                      </div>
                      <p className="text-[10px] text-slate-500 max-w-xs">
                        Applying {jawline.replace(/_/g, ' ')} jawline, {dimpleType.replace(/_/g, ' ')}, {moleLocation.replace(/_/g, ' ')}, and {silhouette} curves.
                      </p>
                    </div>
                  ) : activePreviewUrl ? (
                    <div className="relative w-full h-full group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={activePreviewUrl}
                        src={activePreviewUrl}
                        alt="Persona Appearance Preview"
                        className="w-full h-full object-cover transition-all duration-300"
                      />
                      {isFaceLocked ? (
                        <div className="absolute top-3 left-3 bg-amber-950/85 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-amber-300 border border-amber-500/50 font-mono flex items-center gap-1.5 shadow-sm">
                          <Lock className="w-3 h-3 text-amber-400" />
                          Face Locked ({personaName})
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white border border-slate-700 font-mono flex items-center gap-1.5 shadow-sm">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Live Preview
                        </div>
                      )}
                      <div className="absolute top-3 right-3 bg-emerald-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-emerald-300 border border-emerald-500/40 font-mono shadow-sm">
                        Age {adultAge} Verified
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-xs">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          No Visual Model Reference Set for {personaName}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                          Select {personaName}&apos;s face card, skin complexion, hair, and body metrics on the left, then click <strong>&quot;Synthesize Preview&quot;</strong> below to generate their photorealistic visual model.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Face Lock & Persona Identity Anchor Status Bar */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    isFaceLocked
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/60'
                      : candidateAsset
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300/80 dark:border-indigo-700/60'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isFaceLocked
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : candidateAsset
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isFaceLocked ? <Lock className="w-4 h-4" /> : candidateAsset ? <Sparkles className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {isFaceLocked ? (
                            <>
                              <span className="text-amber-600 dark:text-amber-400">Face &amp; Identity Locked</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-medium">
                                Locked
                              </span>
                            </>
                          ) : candidateAsset ? (
                            <>
                              <span className="text-indigo-600 dark:text-indigo-400">Face Card Candidate Sheet</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-medium">
                                Ready to Lock
                              </span>
                            </>
                          ) : (
                            <span>Unlocked Persona Face</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {isFaceLocked
                            ? `Anchored strictly to ${personaName} • Preserved across all angles & content`
                            : candidateAsset
                              ? 'Two-panel sheet generated (#FFFFFF background). Lock face to crop into anchors.'
                              : `Generate a two-panel face card sheet to establish ${personaName}'s identity`}
                        </p>
                      </div>
                    </div>

                    {isFaceLocked ? (
                      <button
                        type="button"
                        disabled={isLockingFace || isGeneratingFaceCard || synthesizing}
                        onClick={() => setShowReplaceModal(true)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-all border border-slate-200 dark:border-slate-700 hover:border-amber-300 shrink-0 flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Replace Face
                      </button>
                    ) : candidateAsset ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isLockingFace || isGeneratingFaceCard || synthesizing}
                          onClick={handleGenerateFaceCard}
                          className="px-2 py-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-lg transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                        >
                          {isGeneratingFaceCard ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Regenerate'}
                        </button>
                        <button
                          type="button"
                          disabled={isLockingFace || isGeneratingFaceCard || synthesizing}
                          onClick={handleLockFace}
                          className="px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isLockingFace ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                          Lock Face
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          ref={candidateFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadCandidateSheet}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isLockingFace || isGeneratingFaceCard || isUploadingCandidate || synthesizing}
                          onClick={() => candidateFileInputRef.current?.click()}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 disabled:opacity-50"
                          title="Upload your own reference sheet (character photo or two-panel portrait)"
                        >
                          {isUploadingCandidate ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3 text-slate-500" />
                          )}
                          Upload Sheet
                        </button>
                        <button
                          type="button"
                          disabled={isLockingFace || isGeneratingFaceCard || isUploadingCandidate || synthesizing}
                          onClick={handleGenerateFaceCard}
                          className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingFaceCard ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-300" />
                          )}
                          Generate Face Card
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-Angle Strip (5 Default Views: Front, Side, Full View, Full Back, Full Side) */}
                {multiAngles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Multi-Angle Reference Views</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">5 Perspectives</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {multiAngles.map((item) => {
                        const isSelected = selectedAngleView === item.angle;
                        const isCurrentlyRendering = synthesizingAngle === item.angle;
                        const isWaiting = pendingAngles.includes(item.angle);
                        const isCompleted = completedAngles.includes(item.angle);

                        return (
                          <button
                            key={item.angle}
                            type="button"
                            disabled={synthesizing}
                            onClick={() => {
                              setSelectedAngleView(item.angle);
                              if (item.url) {
                                setActivePreviewUrl(item.url);
                              }
                            }}
                            className={`relative rounded-lg overflow-hidden border p-1 text-center transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500'
                                : isCurrentlyRendering
                                  ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 ring-2 ring-indigo-400'
                                  : isWaiting
                                    ? 'border-amber-300/70 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/20 opacity-80'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="relative w-full aspect-square rounded overflow-hidden bg-slate-800 flex items-center justify-center">
                              {item.url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={item.url}
                                  alt={item.label}
                                  className={`w-full h-full object-cover transition-all ${
                                    isCurrentlyRendering ? 'opacity-30 blur-[1px]' : isWaiting ? 'opacity-40' : 'opacity-100'
                                  }`}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-slate-800/80 text-slate-400">
                                  <Camera className="w-4 h-4 opacity-50 mb-0.5" />
                                  <span className="text-[8px] font-medium tracking-tight text-slate-400">{item.label}</span>
                                </div>
                              )}

                              {/* Active Processing Loading Animation */}
                              {isCurrentlyRendering && (
                                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-1 z-10">
                                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mb-1 drop-shadow" />
                                  <span className="text-[7.5px] font-bold text-white tracking-wider uppercase px-1 py-0.5 rounded bg-indigo-600 shadow-xs">
                                    Rendering...
                                  </span>
                                </div>
                              )}

                              {/* Waiting Animation Overlay */}
                              {isWaiting && (
                                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-1 z-10">
                                  <Clock className="w-4 h-4 text-amber-300 animate-pulse mb-1 drop-shadow" />
                                  <span className="text-[7.5px] font-medium text-amber-200 px-1 py-0.5 rounded bg-slate-900/80 border border-amber-400/40">
                                    Waiting...
                                  </span>
                                </div>
                              )}

                              {/* Completed Success Flash Badge */}
                              {isCompleted && !isCurrentlyRendering && (
                                <div className="absolute top-1 right-1 z-10">
                                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                    <Check className="w-2.5 h-2.5" />
                                  </span>
                                </div>
                              )}

                              {/* Front Locked Badge Indicator */}
                              {item.angle === 'front' && isFaceLocked && (
                                <div className="absolute top-1 left-1 z-10">
                                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                                    <Lock className="w-2 h-2" />
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate" title={item.label}>
                              {item.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Synthesis Action Button */}
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled={synthesizing || isGeneratingFaceCard || (!isFaceLocked && faceStatus !== 'locked')}
                    onClick={handleSynthesizePreview}
                    title={
                      !isFaceLocked && faceStatus !== 'locked'
                        ? 'Face must be locked before generating multi-angle views. Generate and lock a face card first.'
                        : undefined
                    }
                    className="w-full h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {synthesizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Rendering Physical Traits...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        Synthesize 5 Perspectives with Selected Traits
                      </>
                    )}
                  </button>
                  {!isFaceLocked && faceStatus !== 'locked' && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center font-medium">
                      ⚠️ Lock face identity above to enable multi-angle view generation.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* PREVIEW DISPLAY 2: ANATOMICAL MAP SCHEMATIC */}
            {previewMode === 'blueprint' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-500/20 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Physical Feature Breakdown
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Schematic</span>
                </div>

                {/* Visual Feature Breakdown Grid */}
                <div className="space-y-2 text-xs">
                  {/* Face Card Blueprint */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 mt-0.5">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Face Architecture
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium">
                          Symmetrical
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
                        • {jawline.replace(/_/g, ' ')} Jawline
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • {eyeShape.replace(/_/g, ' ')} Eyes &amp; {noseBridge.replace(/_/g, ' ')} Nose
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • {lipFullness.replace(/_/g, ' ')} Lips
                      </div>
                    </div>
                  </div>

                  {/* Dimples & Moles Blueprint */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 mt-0.5">
                      <Smile className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Dimples &amp; Signature Marks
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
                          Distinctive
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
                        • Dimple: {dimpleType.replace(/_/g, ' ')} ({dimpleDepth})
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • Beauty Spot: {moleLocation.replace(/_/g, ' ')}
                      </div>
                      {freckles !== 'none' && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                          • Freckles: {freckles.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Curves & Proportions Blueprint */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Body Silhouette &amp; Proportions
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                          3D Framing
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
                        • Silhouette: {silhouette.replace(/_/g, ' ')} ({heightStance})
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • Bust Proportion: {upperBodyBust.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • Hip Silhouette: {lowerBodyHip.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  {/* Skin & Complexion Blueprint */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg border border-slate-300 dark:border-white/20 shrink-0 mt-0.5 flex items-center justify-center text-white"
                      style={{ backgroundColor: skinColorMap[complexion] || '#c68a4c' }}
                    >
                      <Palette className="w-4 h-4 drop-shadow" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white capitalize">
                        {complexion.replace(/_/g, ' ')} Complexion
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
                        • Undertone: {undertone.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        • Surface: {finish.replace(/_/g, ' ')} with micro-pore texture
                      </div>
                    </div>
                  </div>

                  {/* Body Art Blueprint */}
                  {tattooStyle !== 'none' && (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 mt-0.5">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white capitalize">
                          Body Art ({tattooPlacement})
                        </div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
                          • {tattooStyle.replace(/_/g, ' ')}
                        </div>
                        {tattooDescription && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                            {tattooDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approve Model Action */}
            <button
              type="button"
              disabled={approving || synthesizing}
              onClick={handleApproveModel}
              className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {approving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Locking Model Reference...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Approve Preview as Active Model
                </>
              )}
            </button>

            {/* Lock Profile Action */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Locking Profile...' : 'Lock Physical Profile as Default'}
            </button>
          </div>
        </div>
      </div>

      {/* Replace Face Confirmation Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Replace Authoritative Face Identity?
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Generating and locking a new face card candidate will replace the active face and body identity anchors for <strong>{personaName}</strong>.
            </p>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
              ⚠️ <strong>Important Note:</strong> Previously generated multi-angle views and published content retain their previous face anchor.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplaceFace}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-all shadow-xs"
              >
                Proceed &amp; Generate New Face
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
