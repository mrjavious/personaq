'use client';

import React, { useState, useEffect } from 'react';
import { PRESET_VOICES } from '@/lib/ai/voice-provider';

interface VoiceAsset {
  id: string;
  url?: string;
  storageKey: string;
  aiGenerated: boolean;
  createdAt: string;
  provenanceMeta?: string;
}

interface CustomVoice {
  id: string;
  name: string;
  isPreset: boolean;
  description?: string;
}

interface VoiceConsentRecord {
  id: string;
  voiceId: string;
  who: string;
  when: string;
  scope: string;
  revokedAt?: string | null;
}

interface VoiceSynthesisStudioProps {
  personaId: string;
  personaName: string;
  isFaceLocked: boolean;
}

export default function VoiceSynthesisStudio({
  personaId,
  personaName,
  isFaceLocked,
}: VoiceSynthesisStudioProps) {
  const [featureEnabled, setFeatureEnabled] = useState<boolean>(true);
  const [availableVoices, setAvailableVoices] = useState<CustomVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(PRESET_VOICES[0].id);
  const [scriptText, setScriptText] = useState<string>('');
  const [speed, setSpeed] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [audioAssets, setAudioAssets] = useState<VoiceAsset[]>([]);

  // Consent Management Modal State
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [consentWho, setConsentWho] = useState<string>('');
  const [consentVoiceId, setConsentVoiceId] = useState<string>('');
  const [consentScope, setConsentScope] = useState<string>(
    'PersonaQ AI voice synthesis for authorized persona content only'
  );
  const [consentNotes, setConsentNotes] = useState<string>('');
  const [consentList, setConsentList] = useState<VoiceConsentRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [voiceRes, consentRes] = await Promise.all([
          fetch(`/api/persona/voice?personaId=${personaId}`),
          fetch('/api/persona/voice/consent'),
        ]);

        if (voiceRes.ok) {
          const vData = await voiceRes.json();
          setFeatureEnabled(vData.enabled);
          setAvailableVoices(vData.voices || []);
          if (vData.assets) {
            setAudioAssets(vData.assets);
          }
        }

        if (consentRes.ok) {
          const cData = await consentRes.json();
          setConsentList(cData.consents || []);
        }
      } catch (err) {
        console.error('Failed to load voice settings:', err);
      }
    }

    loadData();
  }, [personaId]);

  const refreshVoiceData = async () => {
    try {
      const [voiceRes, consentRes] = await Promise.all([
        fetch(`/api/persona/voice?personaId=${personaId}`),
        fetch('/api/persona/voice/consent'),
      ]);
      if (voiceRes.ok) {
        const vData = await voiceRes.json();
        setFeatureEnabled(vData.enabled);
        setAvailableVoices(vData.voices || []);
        if (vData.assets) setAudioAssets(vData.assets);
      }
      if (consentRes.ok) {
        const cData = await consentRes.json();
        setConsentList(cData.consents || []);
      }
    } catch (err) {
      console.error('Failed to refresh voice data:', err);
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptText.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/persona/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          text: scriptText,
          voiceId: selectedVoiceId,
          speed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Voice synthesis failed');
      }

      setSuccessMsg('Audio synthesized successfully and tagged with AI disclosure.');
      setScriptText('');
      await refreshVoiceData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentVoiceId.trim() || !consentWho.trim() || !consentScope.trim()) return;

    setError(null);
    try {
      const res = await fetch('/api/persona/voice/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: consentVoiceId.trim(),
          who: consentWho.trim(),
          scope: consentScope.trim(),
          notes: consentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record consent');
      }

      setShowConsentModal(false);
      setConsentVoiceId('');
      setConsentWho('');
      setConsentNotes('');
      setSuccessMsg(`Consent recorded for ${data.consent.who} (${data.consent.voiceId})`);
      await refreshVoiceData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const isSelectedPreset = PRESET_VOICES.some((p) => p.id === selectedVoiceId);
  const matchingConsent = consentList.find((c) => c.voiceId === selectedVoiceId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">Voice Synthesis Studio</h2>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                featureEnabled
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
              }`}
            >
              {featureEnabled ? 'FEATURE_VOICE Enabled' : 'FEATURE_VOICE Disabled'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Synthesize speech for <strong className="text-slate-200">{personaName}</strong> with verified consent and automated AI disclosure tagging.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConsentModal(true)}
          className="self-start sm:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          + Record Custom Voice Consent
        </button>
      </div>

      {/* Lock Gate Warning */}
      {!isFaceLocked && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong>Identity Lock Required:</strong> Persona face must be locked before synthesizing voice assets. All generated voice clips are anchored to the canonical face card.
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm">
          {successMsg}
        </div>
      )}

      {/* Synthesis Form */}
      <form onSubmit={handleSynthesize} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voice Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Voice Selection
            </label>
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <optgroup label="System Preset Voices (Always Authorized)">
                {PRESET_VOICES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.gender}, {p.locale})
                  </option>
                ))}
              </optgroup>
              {availableVoices.filter((v) => !v.isPreset).length > 0 && (
                <optgroup label="Authorized Consented Custom Voices">
                  {availableVoices
                    .filter((v) => !v.isPreset)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.id})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            {/* Voice Authorization Status Pill */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              {isSelectedPreset ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  ✓ Built-in Preset: Authorized without custom consent
                </span>
              ) : matchingConsent ? (
                <span className="text-indigo-400 flex items-center gap-1">
                  ✓ Recorded Consent: {matchingConsent.who} (Scope: {matchingConsent.scope})
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  ⚠ Custom Voice: Requires recorded consent before synthesis
                </span>
              )}
            </div>
          </div>

          {/* Speed Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pacing / Speed
              </label>
              <span className="text-xs text-slate-300 font-mono">{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>0.5x Slow</span>
              <span>1.0x Normal</span>
              <span>2.0x Fast</span>
            </div>
          </div>
        </div>

        {/* Script Text Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Speech Script / Dialogue
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={4}
            placeholder="Type or paste the speech script for the persona here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* AI Disclosure & Provenance Note */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Every synthesized audio clip is permanently tagged with <strong>aiGenerated: true</strong> and cryptographic provenance metadata.
          </span>
          <span className="text-slate-500">Zero third-party voice cloning</span>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading || !scriptText.trim() || !isFaceLocked || !featureEnabled}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
        >
          {loading ? 'Synthesizing Speech via Voicebox...' : 'Synthesize Voice Asset'}
        </button>
      </form>

      {/* Audio Asset List */}
      {audioAssets.length > 0 && (
        <div className="border-t border-slate-800 pt-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Generated Voice Assets</h3>
          <div className="grid grid-cols-1 gap-3">
            {audioAssets.map((asset) => (
              <div
                key={asset.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      Audio Asset
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-950 border border-emerald-500/30 text-emerald-300 rounded-full font-mono">
                      AI Generated
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Created on {new Date(asset.createdAt).toLocaleString()} · ID: {asset.id.slice(0, 10)}...
                  </p>
                </div>

                {asset.url && (
                  <audio controls className="w-full sm:w-64 h-8">
                    <source src={asset.url} type="audio/wav" />
                    Your browser does not support audio playback.
                  </audio>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Record Custom Voice Consent</h3>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              In accordance with PersonaQ security policies, cloning of third-party voices is strictly prohibited. Custom voices require a legally verifiable consent record specifying the voice donor, timestamp, and authorized scope.
            </p>

            <form onSubmit={handleRecordConsent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Voice Identifier (voiceId) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. custom_elena_studio_v1"
                  value={consentVoiceId}
                  onChange={(e) => setConsentVoiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Consenting Individual Legal Name (Who) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full legal name of the voice actor / consenting individual"
                  value={consentWho}
                  onChange={(e) => setConsentWho(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Authorized Scope *
                </label>
                <textarea
                  rows={2}
                  required
                  value={consentScope}
                  onChange={(e) => setConsentScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Additional Verification Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Signed release form on file (doc ref #2026-V8)"
                  value={consentNotes}
                  onChange={(e) => setConsentNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Record Consent Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
