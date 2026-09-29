'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Copy,
  Check,
  Plus,
  X,
  FileCode,
  Save,
} from 'lucide-react';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';

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
  versions?: {
    id: string;
    versionNumber: number;
    changeSummary: string | null;
    createdAt: string;
    snapshotJson: string;
  }[];
}

export default function PersonaBiblePage() {
  const [activeTab, setActiveTab] = useState<'edit' | 'prompt' | 'versions'>('edit');
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Prompt preview state
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Form field states
  const [name, setName] = useState('');
  const [adultAge, setAdultAge] = useState(26);
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

  useEffect(() => {
    let isMounted = true;

    async function fetchPersona() {
      try {
        const res = await fetch('/api/persona');
        const data = await res.json();
        if (isMounted && data.persona) {
          const p = data.persona;
          const parsedCatchphrases =
            typeof p.catchphrases === 'string' ? JSON.parse(p.catchphrases) : p.catchphrases || [];
          const parsedBoundaries =
            typeof p.boundaries === 'string' ? JSON.parse(p.boundaries) : p.boundaries || [];
          const parsedPillars =
            typeof p.contentPillars === 'string' ? JSON.parse(p.contentPillars) : p.contentPillars || [];

          setPersona({ ...p, catchphrases: parsedCatchphrases, boundaries: parsedBoundaries, contentPillars: parsedPillars });
          setName(p.name);
          setAdultAge(p.adultAge);
          setBackstory(p.backstory);
          setAppearanceNotes(p.appearanceNotes);
          setVoiceTone(p.voiceTone);
          setCatchphrases(parsedCatchphrases);
          setBoundaries(parsedBoundaries);
          setContentPillars(parsedPillars);
          setAiDisclosureText(p.aiDisclosureText);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load persona');
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchPersona();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Update prompt preview whenever relevant fields change
  useEffect(() => {
    if (!name || !adultAge) return;
    fetch('/api/persona/prompt-preview', {
      method: 'POST',
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
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.prompt) setSystemPrompt(d.prompt);
      })
      .catch(() => {});
  }, [name, adultAge, backstory, appearanceNotes, voiceTone, catchphrases, boundaries, contentPillars, aiDisclosureText]);

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
          changeSummary: changeSummary || 'Persona bible updated',
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(systemPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  if (loading && !persona) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
        Loading Persona Bible...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Persona Bible Manager</h1>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
              Phase 1 Foundations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative source of truth for identity, voice tone, guardrails, and AI prompt context.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'edit'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Edit Bible
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'prompt'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            System Prompt
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'versions'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            History ({persona?.versions?.length || 0})
          </button>
        </div>
      </div>

      {/* Guardrail Validation Feedback Card */}
      <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
        guardrailCheck.valid
          ? 'bg-slate-900/60 border-emerald-500/30 text-slate-300'
          : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
      }`}>
        {guardrailCheck.valid ? (
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 flex-1">
          <div className="font-semibold flex items-center gap-2">
            <span>Section 2 Guardrails Status:</span>
            {guardrailCheck.valid ? (
              <span className="text-emerald-400 font-bold">COMPLIANT</span>
            ) : (
              <span className="text-rose-400 font-bold">VIOLATION DETECTED</span>
            )}
          </div>
          {guardrailCheck.errors.length > 0 && (
            <ul className="list-disc list-inside text-rose-300 space-y-0.5">
              {guardrailCheck.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          {guardrailCheck.warnings && guardrailCheck.warnings.length > 0 && (
            <ul className="list-disc list-inside text-amber-300 space-y-0.5">
              {guardrailCheck.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* TAB 1: EDIT BIBLE */}
      {activeTab === 'edit' && (
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Persona Bible successfully saved and version snapshot recorded!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity & Guardrails Column */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                1. Core Identity & Guardrails
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">Persona Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Aria Nova"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Adult Age <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">Min 18 • Recommended &ge; 25</span>
                </div>
                <input
                  type="number"
                  min={18}
                  max={120}
                  required
                  value={adultAge}
                  onChange={(e) => setAdultAge(parseInt(e.target.value, 10) || 0)}
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none ${
                    adultAge < 18
                      ? 'border-rose-500 text-rose-300'
                      : adultAge < 25
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
                <p className="text-[11px] text-slate-500">
                  Non-negotiable Guardrail 1: minors are strictly blocked.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Mandatory AI Disclosure Text <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={aiDisclosureText}
                  onChange={(e) => setAiDisclosureText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. ✨ Disclosed Fictional AI Persona: Created with generative AI tools."
                />
                <p className="text-[11px] text-slate-500">
                  Injected into all platform profile bios and reminder prompts.
                </p>
              </div>
            </div>

            {/* Backstory & Appearance Column */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 md:col-span-2">
              <h2 className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                2. Worldbuilding & Appearance
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">Backstory & Context</label>
                <textarea
                  rows={4}
                  required
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Describe where the persona lives, their origin story, work, and world..."
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Appearance & Visual Aesthetic Notes
                  </label>
                  <span className="text-[10px] text-purple-400 font-medium">Fictional only • No real likeness</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={appearanceNotes}
                  onChange={(e) => setAppearanceNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Hair, eye color, stylistic traits, outfit notes. Zero resemblance to real celebrities or individuals..."
                />
              </div>
            </div>
          </div>

          {/* Voice, Catchphrases, Boundaries, Content Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Voice & Catchphrases */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                3. Voice Tone & Signature Catchphrases
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">Voice Tone & Mannerisms</label>
                <input
                  type="text"
                  required
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Curious, thoughtful, witty, approachable, and transparently digital"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">Catchphrases / Expressions</label>
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCatchphrase.trim()) {
                        setCatchphrases([...catchphrases, newCatchphrase.trim()]);
                        setNewCatchphrase('');
                      }
                    }}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {catchphrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs"
                    >
                      &ldquo;{phrase}&rdquo;
                      <button
                        type="button"
                        onClick={() => setCatchphrases(catchphrases.filter((_, idx) => idx !== i))}
                        className="text-indigo-400 hover:text-indigo-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Strict Boundaries & Content Pillars */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                4. Strict Boundaries & Content Pillars
              </h2>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newBoundary.trim()) {
                        setBoundaries([...boundaries, newBoundary.trim()]);
                        setNewBoundary('');
                      }
                    }}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {boundaries.map((b, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs"
                    >
                      {b}
                      <button
                        type="button"
                        onClick={() => setBoundaries(boundaries.filter((_, idx) => idx !== i))}
                        className="text-rose-400 hover:text-rose-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">Content Pillars</label>
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPillar.trim()) {
                        setContentPillars([...contentPillars, newPillar.trim()]);
                        setNewPillar('');
                      }
                    }}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {contentPillars.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => setContentPillars(contentPillars.filter((_, idx) => idx !== i))}
                        className="text-purple-400 hover:text-purple-200"
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
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Revision Summary Note (for Version History & Audit Log)
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Refined voice tone and added boundaries for SFW public queues"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !guardrailCheck.valid}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${
                guardrailCheck.valid
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Revision...' : 'Save & Snapshot Bible'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SYSTEM PROMPT PREVIEW */}
      {activeTab === 'prompt' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Compiled AI System Context Prompt</h2>
              <p className="text-xs text-slate-400">
                This exact text is automatically injected into Gemini and Ollama models to guide tone, catchphrases, and guardrails.
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow transition-all"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>

          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap selection:bg-indigo-500/30">
            {systemPrompt || 'Compiling system prompt...'}
          </div>
        </div>
      )}

      {/* TAB 3: VERSION HISTORY */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h2 className="text-sm font-semibold text-white">Immutable Version History</h2>
            <p className="text-xs text-slate-400">
              Every save records a full snapshot. You can roll back to any historical version at any time.
            </p>
          </div>

          <div className="space-y-3">
            {persona?.versions && persona.versions.length > 0 ? (
              persona.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-semibold">
                        v{ver.versionNumber}
                      </span>
                      <span className="text-xs font-medium text-slate-200">
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
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-400" />
                    Restore Revision
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No previous version snapshots found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
