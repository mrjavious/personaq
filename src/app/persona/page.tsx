'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Plus,
  X,
  Save,
  Sliders,
  Users,
  ChevronDown,
  RefreshCw,
  Wand2,
  Send,
  Bot,
  User,
  Trash2,
  Camera,
  Mic,
} from 'lucide-react';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';
import PersonaAgentCards from '@/components/persona/PersonaAgentCards';
import ShotLadderStudio from '@/components/persona/ShotLadderStudio';
import VoiceSynthesisStudio from '@/components/persona/VoiceSynthesisStudio';
import { VisualModelOptions } from '@/lib/persona/visual-types';

interface PersonaData {
  id: string;
  name: string;
  adultAge: number;
  backstory: string;
  appearanceNotes: string;
  voiceTone: string;
  catchphrases: string[];
  boundaries: string[];
  contentPillars: string[];
  aiDisclosureText: string;
  avatarUrl?: string | null;
  visualModelConfig?: string | null;
  faceStatus?: string | null;
  faceAssetId?: string | null;
  bodyAssetId?: string | null;
  versions?: {
    id: string;
    versionNumber: number;
    changeSummary: string | null;
    createdAt: string;
    snapshotJson: string;
  }[];
}

interface PersonaDraft {
  name: string;
  adultAge: number;
  backstory: string;
  voiceTone: string;
  appearanceNotes: string;
  catchphrases: string[];
  boundaries: string[];
  contentPillars: string[];
  aiDisclosureText: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AI_STARTER_PROMPTS = [
  {
    label: '🎧 Cyberpunk DJ',
    prompt: 'Create a 26-year-old underground electronic synthwave DJ in Neo-Tokyo with dark techwear, modular synthesizers, and moody cinematic aesthetics.',
  },
  {
    label: '✨ Parisian Fashion',
    prompt: 'Create a 24-year-old Paris-based fashion storyteller and slow-travel creative with effortless linen styling, warm hazel eyes, and thoughtful lifestyle advice.',
  },
  {
    label: '🚀 Futurist AI Thinker',
    prompt: 'Create a 28-year-old visionary futurist researcher exploring space science, human-AI co-creation, and post-scarcity architecture with structured minimalist coats and sharp silver bob.',
  },
  {
    label: '🌿 Mindful Eco-Creator',
    prompt: 'Create a 25-year-old mindful lifestyle and sustainable architecture creator with earthy aesthetic palettes, calm articulate voice, and organic design workflows.',
  },
];

export default function PersonaAgentStudioPage() {
  const [activeTab, setActiveTab] = useState<'edit' | 'physical' | 'shot-ladder' | 'voice' | 'versions'>('edit');
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [allPersonas, setAllPersonas] = useState<PersonaData[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('new') === 'true';
    }
    return false;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Form field states
  const [name, setName] = useState('');
  const [adultAge, setAdultAge] = useState(21);
  const [backstory, setBackstory] = useState('');
  const [appearanceNotes, setAppearanceNotes] = useState('');
  const [voiceTone, setVoiceTone] = useState('');
  const [catchphrases, setCatchphrases] = useState<string[]>([]);
  const [boundaries, setBoundaries] = useState<string[]>([]);
  const [contentPillars, setContentPillars] = useState<string[]>([]);
  const [aiDisclosureText, setAiDisclosureText] = useState('');

  // Input tag states
  const [newCatchphrase, setNewCatchphrase] = useState('');
  const [newBoundary, setNewBoundary] = useState('');
  const [newPillar, setNewPillar] = useState('');

  // AI Persona Creator Modal State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "👋 Welcome! I am your **AI Persona Agent Architect**.\n\nDescribe the persona you want to build—their vibe, profession, visual aesthetic, personality, or niche (e.g. *'A 24yo techno producer from Berlin with dark cyberpunk techwear and dry wit'*). I'll craft a complete identity blueprint with safety guardrails in real time. Or click any starter prompt above to begin!",
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [personaDraft, setPersonaDraft] = useState<PersonaDraft | null>(null);
  const [creatingPersona, setCreatingPersona] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Remove Persona Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const applyPersonaData = (p: PersonaData) => {
    const parsedCatchphrases =
      typeof p.catchphrases === 'string' ? JSON.parse(p.catchphrases) : p.catchphrases || [];
    const parsedBoundaries =
      typeof p.boundaries === 'string' ? JSON.parse(p.boundaries) : p.boundaries || [];
    const parsedPillars =
      typeof p.contentPillars === 'string' ? JSON.parse(p.contentPillars) : p.contentPillars || [];

    setPersona({
      ...p,
      catchphrases: parsedCatchphrases,
      boundaries: parsedBoundaries,
      contentPillars: parsedPillars,
    });
    setSelectedPersonaId(p.id);
    setName(p.name);
    setAdultAge(p.adultAge);
    setBackstory(p.backstory);
    setAppearanceNotes(p.appearanceNotes);
    setVoiceTone(p.voiceTone);
    setCatchphrases(parsedCatchphrases);
    setBoundaries(parsedBoundaries);
    setContentPillars(parsedPillars);
    setAiDisclosureText(p.aiDisclosureText);
  };

  const fetchPersonas = useCallback(async (targetId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = targetId ? `/api/persona?id=${targetId}` : `/api/persona`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.allPersonas && Array.isArray(data.allPersonas)) {
        setAllPersonas(data.allPersonas);
      }

      if (data.persona) {
        applyPersonaData(data.persona);
      } else if (data.allPersonas && data.allPersonas.length > 0) {
        applyPersonaData(data.allPersonas[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load persona data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const idFromUrl = params.get('id');
      fetchPersonas(idFromUrl || undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshTrigger, fetchPersonas]);

  const handleSelectPersona = async (personaId: string) => {
    if (personaId === selectedPersonaId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/persona?id=${personaId}`);
      const data = await res.json();
      if (data.persona) {
        applyPersonaData(data.persona);
        window.history.pushState(null, '', `/persona?id=${personaId}`);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to switch persona');
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setChatMessages([
      {
        role: 'assistant',
        content:
          "👋 Welcome! I am your **AI Persona Agent Architect**.\n\nDescribe the persona you want to build—their vibe, profession, visual aesthetic, personality, or niche (e.g. *'A 24yo techno producer from Berlin with dark cyberpunk techwear and dry wit'*). I'll craft a complete identity blueprint with safety guardrails in real time. Or click any starter prompt above to begin!",
      },
    ]);
    setChatInput('');
    setIsAiThinking(false);
    setPersonaDraft(null);
    setCreateError(null);
  };

  const handleSendAiMessage = async (userText?: string) => {
    const textToSend = (userText || chatInput).trim();
    if (!textToSend || isAiThinking) return;

    setCreateError(null);
    setChatInput('');
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(updatedMessages);
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/persona/ai-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI generation failed');
      }

      const replyContent = data.reply || data.message;
      if (replyContent) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: replyContent }]);
      }

      const drafted = data.personaDraft || data.draft;
      if (drafted) {
        setPersonaDraft(drafted);
      }
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : 'Failed to generate persona with AI');
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleFinalizePersona = async () => {
    if (!personaDraft) {
      setCreateError('Please chat with the AI to generate a persona blueprint first.');
      return;
    }

    setCreateError(null);

    const name = (personaDraft.name || '').trim();
    if (!name) {
      setCreateError('Persona name is required.');
      return;
    }

    const rawAge = Math.round(Number(personaDraft.adultAge));
    const adultAge = isNaN(rawAge) ? 21 : Math.min(120, Math.max(18, rawAge));

    const backstory = (personaDraft.backstory || '').trim() ||
      `${name} is an autonomous digital persona agent living at the intersection of creative storytelling, tech, and cultural aesthetics.`;

    const appearanceNotes = (personaDraft.appearanceNotes || '').trim() || 'Modern stylized aesthetic, tailored digital look.';
    const voiceTone = (personaDraft.voiceTone || '').trim() || 'Approachable, witty, and authentic.';
    const aiDisclosureText = (personaDraft.aiDisclosureText || '').trim() || '✨ Disclosed Fictional AI Persona: Created with generative AI tools. 100% fictional identity.';

    const validation = validatePersonaGuardrails({
      adultAge,
      aiDisclosureText,
      name,
    });

    if (!validation.valid) {
      setCreateError(validation.errors.join('; '));
      return;
    }

    setCreatingPersona(true);
    try {
      const payload = {
        name: name.slice(0, 100),
        adultAge,
        backstory: backstory.slice(0, 5000),
        appearanceNotes: appearanceNotes.slice(0, 5000),
        voiceTone: voiceTone.slice(0, 500),
        catchphrases: Array.isArray(personaDraft.catchphrases) && personaDraft.catchphrases.length > 0
          ? personaDraft.catchphrases
          : ['Living in pixels.', 'Curating digital moments.'],
        boundaries: Array.isArray(personaDraft.boundaries) && personaDraft.boundaries.length > 0
          ? personaDraft.boundaries
          : ['Never depict minors', 'Platform-compliant SFW only'],
        contentPillars: Array.isArray(personaDraft.contentPillars) && personaDraft.contentPillars.length > 0
          ? personaDraft.contentPillars
          : ['Lifestyle & Creativity', 'Behind the Scenes'],
        aiDisclosureText: aiDisclosureText.slice(0, 1000),
      };

      const res = await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.persona) {
        let errorMsg = data.error || 'Failed to create persona agent';
        if (data.details?.fieldErrors) {
          const fieldMsgs = Object.entries(data.details.fieldErrors)
            .flatMap(([field, msgs]) => Array.isArray(msgs) ? msgs.map((m: string) => `${field}: ${m}`) : [])
            .join('; ');
          if (fieldMsgs) {
            errorMsg = `${errorMsg} (${fieldMsgs})`;
          }
        }
        throw new Error(errorMsg);
      }

      setAllPersonas((prev) => [data.persona, ...prev]);
      applyPersonaData(data.persona);
      window.history.pushState(null, '', `/persona?id=${data.persona.id}`);

      setIsCreateModalOpen(false);
      resetCreateForm();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setCreatingPersona(false);
    }
  };

  const handleDeletePersona = async () => {
    if (!persona) return;
    if (allPersonas.length <= 1) {
      setDeleteError('Cannot remove the only persona. At least one persona is required.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/persona/${persona.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove persona');
      }

      setIsDeleteModalOpen(false);
      const nextRemaining = allPersonas.filter((p) => p.id !== persona.id);
      setAllPersonas(nextRemaining);
      if (nextRemaining.length > 0) {
        applyPersonaData(nextRemaining[0]);
        window.history.pushState(null, '', `/persona?id=${nextRemaining[0].id}`);
      }
    } catch (err) {
      console.error(err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete persona');
    } finally {
      setDeleting(false);
    }
  };


  // Guardrail check
  const guardrailCheck = validatePersonaGuardrails({
    adultAge,
    aiDisclosureText,
    name,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!persona) return;
    setError(null);
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/persona/${persona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          adultAge,
          backstory,
          appearanceNotes,
          voiceTone,
          catchphrases,
          boundaries,
          contentPillars,
          aiDisclosureText,
          changeSummary: changeSummary || 'Persona agent updated',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update persona');
      }

      setSaveSuccess(true);
      setChangeSummary('');
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhysicalDna = async (updatedConfig: VisualModelOptions, summaryText: string) => {
    if (!persona) return;
    setSaving(true);
    try {
      const mergedConfig = JSON.stringify(updatedConfig);
      const cleanBaseNotes = persona.appearanceNotes
        .replace(/\[Visual Reference Model:[\s\S]*?(?=(\n\n|$))/g, '')
        .replace(/• (Face Card|Dimple|Skin Tone|Distinctive Marks|Body Silhouette|Body Art):[^\n]*\n?/g, '')
        .replace(/(often wears|wears|wearing|attire|outfit|clothing|fashion|kurtas|techwear|accessories)[\s\S]*?(?=(\.|$))/gi, '')
        .trim();

      const newAppearanceNotes = summaryText ? `${summaryText}\n\n${cleanBaseNotes}`.trim() : cleanBaseNotes;

      const res = await fetch(`/api/persona/${persona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: persona.name,
          adultAge: persona.adultAge,
          backstory: persona.backstory,
          appearanceNotes: newAppearanceNotes,
          voiceTone: persona.voiceTone,
          catchphrases: persona.catchphrases,
          boundaries: persona.boundaries,
          contentPillars: persona.contentPillars,
          aiDisclosureText: persona.aiDisclosureText,
          visualModelConfig: mergedConfig,
          changeSummary: 'Updated Persona Physical DNA pieces (Face card, dimples, skin tone, moles, body curves, tattoos)',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save DNA');
      if (data.persona) {
        setPersona((prev) => (prev ? { ...prev, ...data.persona } : null));
        setAppearanceNotes(newAppearanceNotes);
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save DNA');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!persona || !confirm('Are you sure you want to restore this revision?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/persona/${persona.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab('edit');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !persona) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 animate-spin mr-2 text-indigo-600 dark:text-indigo-400" />
        Loading Persona Agent...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Persona Selector & Creation Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Active Persona:
            </span>
          </div>

          <div className="relative min-w-[260px]">
            <select
              value={selectedPersonaId}
              onChange={(e) => handleSelectPersona(e.target.value)}
              className="w-full h-10 appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white font-medium pr-9 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {allPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Age {p.adultAge}) {p.avatarUrl ? '• Model Active' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
            {allPersonas.length} {allPersonas.length === 1 ? 'persona' : 'personas'} registered
          </span>
        </div>

        <div className="flex items-center gap-2">
          {persona && (
            <button
              type="button"
              disabled={allPersonas.length <= 1}
              onClick={() => {
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              title={
                allPersonas.length <= 1
                  ? 'Cannot remove the only registered persona'
                  : `Remove ${persona.name}`
              }
              className="h-10 px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:border-rose-300 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Persona</span>
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Persona Agent Studio</h1>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
              Identity &amp; Visual Studio
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative source of truth for identity, voice tone, guardrails, and AI prompt context.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'edit'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Edit Agent Profile
          </button>
          <button
            onClick={() => setActiveTab('physical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'physical'
                ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Physical Features &amp; Appearance
          </button>
          <button
            onClick={() => setActiveTab('shot-ladder')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'shot-ladder'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Shot Ladder &amp; Sets
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'voice'
                ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            Voice Studio
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'versions'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            History ({persona?.versions?.length || 0})
          </button>
        </div>
      </div>

      {/* Persona Visual Reference Status Banner */}
      {persona && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              {persona.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={persona.avatarUrl}
                  alt={persona.name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold';
                      placeholder.innerText = persona.name.charAt(0);
                      e.currentTarget.parentElement.appendChild(placeholder);
                    }
                  }}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 font-bold">
                  {persona.name.charAt(0)}
                </div>
              )}
              {persona.avatarUrl && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow-xs">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{persona.name}</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  Adult Age {persona.adultAge}
                </span>
                {persona.avatarUrl ? (
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    Visual Model Active
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                    No Visual Model Set
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                {persona.avatarUrl
                  ? 'Authoritative visual reference established with open-source visual pipeline.'
                  : 'Generate a photorealistic face, body structure, and cultural look.'}
              </p>
            </div>
          </div>

          <Link
            href="/content-manager"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all self-start sm:self-auto shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            Produce Media in Content Manager
          </Link>
        </div>
      )}

      {/* Guardrail Validation Feedback Card */}
      <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
        guardrailCheck.valid
          ? 'bg-white dark:bg-slate-900/60 border-emerald-200 dark:border-emerald-500/30 text-slate-700 dark:text-slate-300'
          : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
      }`}>
        {guardrailCheck.valid ? (
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 flex-1">
          <div className="font-semibold flex items-center gap-2">
            <span>Section 2 Guardrails Status:</span>
            {guardrailCheck.valid ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">COMPLIANT</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-bold">VIOLATION DETECTED</span>
            )}
          </div>
          {guardrailCheck.errors.length > 0 && (
            <ul className="list-disc list-inside text-rose-700 dark:text-rose-300 space-y-0.5">
              {guardrailCheck.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          {guardrailCheck.warnings && guardrailCheck.warnings.length > 0 && (
            <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-0.5">
              {guardrailCheck.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* TAB 1: EDIT AGENT PROFILE */}
      {activeTab === 'edit' && (
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Persona Agent successfully saved and version snapshot recorded!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity & Guardrails Column */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 transition-colors">
              <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                1. Core Identity &amp; Guardrails
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">Persona Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Aria Nova"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Adult Age <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Min 18 • Recom &ge; 21</span>
                </div>
                <input
                  type="number"
                  min={18}
                  max={120}
                  required
                  value={adultAge}
                  onChange={(e) => setAdultAge(parseInt(e.target.value, 10) || 0)}
                  className={`w-full h-10 bg-slate-50 dark:bg-slate-950 border rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none ${
                    adultAge < 18
                      ? 'border-rose-400 text-rose-600 dark:text-rose-400'
                      : adultAge < 21
                      ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  }`}
                />
                <p className="text-[11px] text-slate-500">
                  Guardrail 1: minors are strictly blocked.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Mandatory AI Disclosure Text <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={aiDisclosureText}
                  onChange={(e) => setAiDisclosureText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  placeholder="e.g. ✨ Disclosed Fictional AI Persona: Created with generative AI tools."
                />
                <p className="text-[11px] text-slate-500">
                  Injected into all platform profile bios and reminder prompts.
                </p>
              </div>
            </div>

            {/* Backstory & Appearance Column */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 md:col-span-2 transition-colors">
              <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                2. Worldbuilding &amp; Appearance
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">Backstory &amp; Context</label>
                <textarea
                  rows={4}
                  required
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe where the persona lives, their origin story, work, and world..."
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Appearance &amp; Visual Aesthetic Notes (Physical Features Only)
                  </label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Physical appearance only • No clothing</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={appearanceNotes}
                  onChange={(e) => setAppearanceNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Physical features only: facial structure, eye shape and color, skin tone, hair texture and length, distinctive marks, and build. Do not mention clothing or outfits..."
                />
              </div>
            </div>
          </div>

          {/* Voice, Catchphrases, Boundaries, Content Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Voice & Catchphrases */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 transition-colors">
              <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                3. Voice Tone &amp; Signature Catchphrases
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">Voice Tone &amp; Mannerisms</label>
                <input
                  type="text"
                  required
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Curious, thoughtful, witty, approachable, and transparently digital"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">Catchphrases / Expressions</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatchphrase}
                    onChange={(e) => setNewCatchphrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCatchphrase.trim()) {
                          setCatchphrases([...catchphrases, newCatchphrase.trim()]);
                          setNewCatchphrase('');
                        }
                      }
                    }}
                    placeholder="Type phrase and press Enter..."
                    className="flex-1 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCatchphrase.trim()) {
                        setCatchphrases([...catchphrases, newCatchphrase.trim()]);
                        setNewCatchphrase('');
                      }
                    }}
                    className="h-10 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {catchphrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-xs font-medium"
                    >
                      &ldquo;{phrase}&rdquo;
                      <button
                        type="button"
                        onClick={() => setCatchphrases(catchphrases.filter((_, idx) => idx !== i))}
                        className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Strict Boundaries & Content Pillars */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 transition-colors">
              <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                4. Strict Boundaries &amp; Content Pillars
              </h2>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Strict Boundaries (Negative Constraints)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBoundary}
                    onChange={(e) => setNewBoundary(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newBoundary.trim()) {
                          setBoundaries([...boundaries, newBoundary.trim()]);
                          setNewBoundary('');
                        }
                      }
                    }}
                    placeholder="e.g. Never simulate real grief or living figures..."
                    className="flex-1 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newBoundary.trim()) {
                        setBoundaries([...boundaries, newBoundary.trim()]);
                        setNewBoundary('');
                      }
                    }}
                    className="h-10 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {boundaries.map((b, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 text-xs font-medium"
                    >
                      {b}
                      <button
                        type="button"
                        onClick={() => setBoundaries(boundaries.filter((_, idx) => idx !== i))}
                        className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">Content Pillars</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPillar}
                    onChange={(e) => setNewPillar(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newPillar.trim()) {
                          setContentPillars([...contentPillars, newPillar.trim()]);
                          setNewPillar('');
                        }
                      }
                    }}
                    placeholder="e.g. Creative Tech & Workflows..."
                    className="flex-1 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPillar.trim()) {
                        setContentPillars([...contentPillars, newPillar.trim()]);
                        setNewPillar('');
                      }
                    }}
                    className="h-10 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {contentPillars.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-xs font-medium"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => setContentPillars(contentPillars.filter((_, idx) => idx !== i))}
                        className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Revision Note & Save Button */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4 transition-colors">
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                Revision Summary Note (for Version History &amp; Audit Log)
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Refined voice tone and added boundaries for SFW public queues"
                className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !guardrailCheck.valid}
              className={`w-full sm:w-auto h-10 px-6 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 ${
                guardrailCheck.valid
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Revision...' : 'Save & Snapshot Agent'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: PHYSICAL DNA PIECES */}
      {activeTab === 'physical' && persona && (
        <PersonaAgentCards
          key={persona.id}
          initialConfig={persona.visualModelConfig}
          initialAvatarUrl={persona.avatarUrl}
          initialFaceStatus={persona.faceStatus || undefined}
          personaName={persona.name}
          adultAge={persona.adultAge}
          personaId={persona.id}
          onSaveDna={handleSavePhysicalDna}
          onModelApproved={(updatedPersona) => {
            setPersona((prev) => (prev ? { ...prev, ...updatedPersona } : null));
            setRefreshTrigger((prev) => prev + 1);
          }}
          isSaving={saving}
        />
      )}

      {/* TAB: SHOT LADDER STUDIO */}
      {activeTab === 'shot-ladder' && persona && (
        <ShotLadderStudio
          personaId={persona.id}
          personaName={persona.name}
          faceStatus={persona.faceStatus || 'none'}
        />
      )}

      {/* TAB: VOICE SYNTHESIS STUDIO */}
      {activeTab === 'voice' && persona && (
        <VoiceSynthesisStudio
          personaId={persona.id}
          personaName={persona.name}
          isFaceLocked={persona.faceStatus === 'locked'}
        />
      )}

      {/* TAB 2: VERSION HISTORY */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition-colors">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Immutable Version History</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every save records a full snapshot. You can roll back to any historical version at any time.
            </p>
          </div>

          <div className="space-y-3">
            {persona?.versions && persona.versions.length > 0 ? (
              persona.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold">
                        v{ver.versionNumber}
                      </span>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {ver.changeSummary || 'Persona updated'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(ver.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRollback(ver.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    Restore Revision
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                No previous version snapshots found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create New Persona Agent Modal (AI Prompt Model) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col h-[90vh] max-h-[900px] overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                      AI Persona Agent Architect
                    </h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                      Interactive Prompt Model
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chat with the AI to shape character lore, aesthetic DNA, and platform safety guardrails.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetCreateForm();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Two-Column Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Column: AI Chat Interface */}
              <div className="lg:col-span-7 flex flex-col h-full min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {/* Starter Prompts Bar */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30 shrink-0">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                    Quick Starter Ideas (Click to generate)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_STARTER_PROMPTS.map((starter, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendAiMessage(starter.prompt)}
                        disabled={isAiThinking}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {starter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-colors ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-800/80 whitespace-pre-line'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* AI Generating Indicator */}
                  {isAiThinking && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800/80 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>AI Architect is sculpting persona identity &amp; guardrails...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input Bar */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendAiMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isAiThinking}
                      placeholder="Describe your persona or refine (e.g. 'Make her 24, from Berlin, sarcastic humor, loves vinyl')..."
                      className="flex-1 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isAiThinking || !chatInput.trim()}
                      className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Live Persona Agent Blueprint Preview */}
              <div className="lg:col-span-5 flex flex-col h-full min-h-0 bg-slate-50 dark:bg-slate-950/60 p-5 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Live Persona Blueprint
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Real-time identity spec generated by AI
                    </p>
                  </div>
                  {personaDraft ? (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready to Finalize
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Awaiting Prompt
                    </span>
                  )}
                </div>

                {!personaDraft ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        No Persona Blueprint Yet
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                        Type a description in the chat or click one of the quick starter ideas to generate a structured Persona Agent spec.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Persona Card Header */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                          {personaDraft.name.charAt(0) || 'P'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {personaDraft.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                              Age {personaDraft.adultAge} (≥{personaDraft.adultAge >= 21 ? '21' : '18'} verified)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Voice Tone */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Voice Tone &amp; Personality
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                        {personaDraft.voiceTone}
                      </p>
                    </div>

                    {/* Backstory */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Lore &amp; Backstory
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {personaDraft.backstory}
                      </p>
                    </div>

                    {/* Physical Styling */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Physical Appearance &amp; Style
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {personaDraft.appearanceNotes}
                      </p>
                    </div>

                    {/* Content Pillars */}
                    {personaDraft.contentPillars && personaDraft.contentPillars.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Content Pillars
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {personaDraft.contentPillars.map((pillar, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-medium"
                            >
                              {pillar}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safety & Compliance Badge */}
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[11px]">Safety Guardrails Compliant</div>
                        <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                          {personaDraft.aiDisclosureText}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Finalize Action */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Section 2 Guardrails: Adult verified (≥21) • Mandatory AI synthetic disclosure</span>
              </div>

              {createError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleFinalizePersona}
                  disabled={!personaDraft || creatingPersona}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {creatingPersona ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Persona Agent...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Finalize Persona Agent</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Persona Confirmation Modal */}
      {isDeleteModalOpen && persona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Remove Persona Agent
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Permanent removal confirmation
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 dark:text-white font-semibold">{persona.name}</strong>?
              This will permanently delete their visual models, physical DNA, version snapshots, and generated angle portraits. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePersona}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
