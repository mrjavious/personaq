'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface SceneSet {
  id: string;
  name: string;
  setText: string;
  lightingJson: string;
}

interface ShotLadderResultItem {
  step: string;
  templateName: string;
  asset: {
    id: string;
    url: string;
    safetyStatus: string;
  };
  consistency: {
    score: number;
    reasons: string[];
    passed: boolean;
    status: string;
  };
  videoMeta: {
    videoPrompt: string;
    beats: Array<{ startSec: number; endSec: number; action: string }>;
  };
}

interface ShotLadderStudioProps {
  personaId: string;
  personaName: string;
  faceStatus: 'unlocked' | 'candidate' | 'locked' | string;
}

export default function ShotLadderStudio({
  personaId,
  personaName,
  faceStatus,
}: ShotLadderStudioProps) {
  const [sceneSets, setSceneSets] = useState<SceneSet[]>([]);
  const [selectedSceneSetId, setSelectedSceneSetId] = useState<string>('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetText, setNewSetText] = useState('');
  const [newKeyDirection, setNewKeyDirection] = useState('45-degree key light from camera left');
  const [newTimeOfDay, setNewTimeOfDay] = useState('golden hour natural sunlight');

  const [actionInput, setActionInput] = useState('');
  const [expressionInput, setExpressionInput] = useState('thoughtful glance');

  const [isGenerating, setIsGenerating] = useState(false);
  const [ladderResults, setLadderResults] = useState<ShotLadderResultItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLocked = faceStatus === 'locked';

  useEffect(() => {
    async function loadSceneSets() {
      try {
        const res = await fetch(`/api/persona/scene-sets?personaId=${personaId}`);
        if (res.ok) {
          const data = await res.json();
          setSceneSets(data.sceneSets || []);
          if (data.sceneSets?.length > 0 && !selectedSceneSetId) {
            setSelectedSceneSetId(data.sceneSets[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load scene sets:', err);
      }
    }
    loadSceneSets();
  }, [personaId, selectedSceneSetId]);

  const handleCreateSceneSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName || !newSetText) return;

    try {
      const res = await fetch('/api/persona/scene-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          name: newSetName,
          setText: newSetText,
          lightingJson: {
            keyDirection: newKeyDirection,
            timeOfDay: newTimeOfDay,
            volumetric: 'subtle atmospheric particles',
            rimLight: 'soft edge glow',
            bokeh: 'creamy circular background blur',
            colourGrade: 'cinematic neutral warm grade',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSceneSets((prev) => [data.sceneSet, ...prev]);
        setSelectedSceneSetId(data.sceneSet.id);
        setIsCreatingSet(false);
        setNewSetName('');
        setNewSetText('');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to create scene set');
      }
    } catch {
      setErrorMsg('Network error creating scene set');
    }
  };

  const handleQueueLadder = async () => {
    if (!isLocked) {
      setErrorMsg('Persona face must be locked before generating a shot ladder.');
      return;
    }
    if (!selectedSceneSetId) {
      setErrorMsg('Please select or create a scene set first.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/persona/shot-ladder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          sceneSetId: selectedSceneSetId,
          action: actionInput || undefined,
          expression: expressionInput || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409) {
          setErrorMsg(err.error || 'Persona face must be locked before generating shot ladder (HTTP 409).');
        } else {
          setErrorMsg(err.error || `Generation failed: HTTP ${res.status}`);
        }
        return;
      }

      const data = await res.json();
      setLadderResults(data.results || []);
    } catch {
      setErrorMsg('Network error executing shot ladder.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🪜</span> Scene Templates & Shot Ladder
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Generate 3 sequential canonical perspectives (Portrait → Action → Full-Body) anchored to {personaName}’s locked face.
          </p>
        </div>

        {!isLocked && (
          <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium flex items-center gap-1.5">
            <span>🔒</span>
            <span>Face card must be locked before queueing ladder</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-white font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Scene Set Selector & Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-slate-300">
              Active Scene Set
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingSet(!isCreatingSet)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {isCreatingSet ? 'Cancel' : '+ New Scene Set'}
            </button>
          </div>

          {isCreatingSet ? (
            <form onSubmit={handleCreateSceneSet} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Scene Set Name</label>
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Modern Minimalist Loft"
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Environment & Set Text (Verbatim)</label>
                <textarea
                  value={newSetText}
                  onChange={(e) => setNewSetText(e.target.value)}
                  placeholder="Spacious Scandinavian sunlit loft, raw concrete accents, fiddle leaf fig in corner..."
                  rows={2}
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Key Direction</label>
                  <input
                    type="text"
                    value={newKeyDirection}
                    onChange={(e) => setNewKeyDirection(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Time of Day</label>
                  <input
                    type="text"
                    value={newTimeOfDay}
                    onChange={(e) => setNewTimeOfDay(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white transition"
              >
                Save Scene Set
              </button>
            </form>
          ) : (
            <div>
              {sceneSets.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-400">
                  No scene sets configured yet. Click &quot;+ New Scene Set&quot; to configure lighting & environment.
                </div>
              ) : (
                <select
                  value={selectedSceneSetId}
                  onChange={(e) => setSelectedSceneSetId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {sceneSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Action & Expression Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-300">
              Action / Stance Directive
            </label>
            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder="e.g. reviewing architectural blueprints with morning espresso"
              className="w-full mt-1.5 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-300">
              Expression
            </label>
            <select
              value={expressionInput}
              onChange={(e) => setExpressionInput(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="thoughtful glance">Thoughtful Glance</option>
              <option value="soft half-smile">Soft Half-Smile</option>
              <option value="mid-laugh">Mid-Laugh</option>
              <option value="subtle closed-lip smile">Subtle Closed-Lip Smile</option>
              <option value="calm deadpan">Calm Deadpan</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ladder Rungs Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
            Rung 1: Portrait
          </div>
          <div className="text-sm font-semibold text-white">50mm T2 Cinema</div>
          <div className="text-xs text-slate-400 mt-1">Medium close-up, sharp facial details, gentle background roll-off.</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
          <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
            Rung 2: Action
          </div>
          <div className="text-sm font-semibold text-white">35mm T2.8 Wide</div>
          <div className="text-xs text-slate-400 mt-1">Dynamic environmental composition with full architectural context.</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            Rung 3: Full-Body
          </div>
          <div className="text-sm font-semibold text-white">Candid 35mm f/2.0</div>
          <div className="text-xs text-slate-400 mt-1">Full-length documentary framing with natural grounded silhouette.</div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={handleQueueLadder}
          disabled={!isLocked || isGenerating || !selectedSceneSetId}
          title={!isLocked ? 'Lock face card identity before queueing ladder' : undefined}
          className={`px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition shadow-lg ${
            !isLocked || isGenerating || !selectedSceneSetId
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-[0.99]'
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Synthesizing Shot Ladder...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Queue Shot Ladder (Portrait → Action → Full-Body)</span>
            </>
          )}
        </button>
      </div>

      {/* Results Display */}
      {ladderResults.length > 0 && (
        <div className="pt-6 border-t border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Generated Ladder Results
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ladderResults.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-slate-900">
                  <Image
                    src={item.asset.url}
                    alt={item.templateName}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur rounded text-[11px] font-bold text-white capitalize">
                    {item.step}
                  </div>
                  {/* Consistency badge */}
                  <div
                    className={`absolute bottom-2 right-2 px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur ${
                      item.consistency.passed
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    }`}
                  >
                    Match: {item.consistency.score}% ({item.consistency.status})
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {item.templateName}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.consistency.reasons.join('; ')}
                    </div>
                  </div>

                  {/* Video Prompt details */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-bold text-indigo-400 uppercase">
                      Video Prompt Saved:
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                      {item.videoMeta.videoPrompt}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {item.videoMeta.beats.length} camera timing beats stored
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
