'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Lock,
  CheckCircle2,
  XCircle,
  Eye,
  FileCheck,
  RefreshCw,
  X,
} from 'lucide-react';

interface SafetyAsset {
  id: string;
  storageKey: string;
  url: string | null;
  suitability: string;
  safetyStatus: string;
  safetyReasons: string | null;
  provenanceMeta: string | null;
  createdAt: string;
}

export default function SafetyGatePage() {
  const [activeTab, setActiveTab] = useState<'review' | 'blocked' | 'all'>('review');
  const [assets, setAssets] = useState<SafetyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Override Modal State
  const [selectedAsset, setSelectedAsset] = useState<SafetyAsset | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSafetyQueue() {
      try {
        const res = await fetch('/api/assets');
        const data = await res.json();
        if (isMounted && data.assets) {
          setAssets(data.assets);
        }
      } catch (err) {
        console.error('Failed to load safety queue:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSafetyQueue();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const filteredAssets = assets.filter((a) => {
    if (activeTab === 'review') return a.safetyStatus === 'needs_manual_review';
    if (activeTab === 'blocked') return a.safetyStatus === 'blocked';
    return true;
  });

  const handleApproveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setOverrideError(null);
    setOverriding(true);

    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit override');
      }

      setSelectedAsset(null);
      setOverrideReason('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setOverriding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Safety Gate Pipeline</h1>
            <span className="text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/40">
              Section 5.3 Hard Guardrails
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Triple-check classifier gate verifying apparent age, real-person likeness, and platform suitability before scheduling.
          </p>
        </div>

        <button
          onClick={() => setRefreshTrigger((prev) => prev + 1)}
          className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium flex items-center gap-1.5 self-start sm:self-center transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* Pipeline Stages Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 transition-colors">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
            <UserCheck className="w-4 h-4" />
            Stage 1: Apparent-Age Check
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Hard-blocks any indication of a minor or youthful appearance (&lt; 21 threshold). Non-negotiable Guardrail 1.
          </p>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono flex items-center gap-1 pt-0.5">
            <XCircle className="w-3 h-3" /> Overrides strictly prohibited
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 transition-colors">
          <div className="flex items-center gap-2 text-sky-600 dark:text-cyan-400 font-semibold text-xs">
            <Sparkles className="w-4 h-4" />
            Stage 2: Real-Person Likeness
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Face similarity check against celebrities and living public figures (&gt;= 70% match hard blocked).
          </p>
          <div className="text-[10px] text-sky-600 dark:text-cyan-400 font-mono flex items-center gap-1 pt-0.5">
            <CheckCircle2 className="w-3 h-3" /> 100% fictional identity only
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 transition-colors">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
            <Lock className="w-4 h-4" />
            Stage 3: Platform SFW Check
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Evaluates NSFW classifier score against target platforms&apos; rules. Borderline cases sent for manual review.
          </p>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1 pt-0.5">
            <AlertTriangle className="w-3 h-3" /> Audit-logged human override allowed
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('review')}
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'review'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Manual Review ({assets.filter((a) => a.safetyStatus === 'needs_manual_review').length})
          </button>

          <button
            onClick={() => setActiveTab('blocked')}
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'blocked'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Hard-Blocked ({assets.filter((a) => a.safetyStatus === 'blocked').length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Evaluated Assets ({assets.length})
          </button>
        </div>
      </div>

      {/* Assets Table / Queue */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">Loading safety records...</div>
      ) : filteredAssets.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-3.5 font-semibold">Preview</th>
                  <th className="p-3.5 font-semibold">Asset ID</th>
                  <th className="p-3.5 font-semibold">Suitability</th>
                  <th className="p-3.5 font-semibold">Safety Status</th>
                  <th className="p-3.5 font-semibold">Classifier Reasons</th>
                  <th className="p-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredAssets.map((asset) => {
                  const reasons: string[] = asset.safetyReasons ? JSON.parse(asset.safetyReasons) : [];

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all">
                      <td className="p-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                          {asset.url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={asset.url} alt="Thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <FileCheck className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {asset.id.slice(0, 10)}...
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            asset.suitability === 'adult_only'
                              ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40'
                              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                          }`}
                        >
                          {asset.suitability}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            asset.safetyStatus === 'passed'
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : asset.safetyStatus === 'blocked'
                              ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {asset.safetyStatus}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-md">
                        {reasons.length > 0 ? (
                          <div className="space-y-0.5">
                            {reasons.slice(0, 2).map((r, i) => (
                              <p key={i} className="truncate">• {r}</p>
                            ))}
                            {reasons.length > 2 && (
                              <span className="text-[10px] text-slate-500">+{reasons.length - 2} more findings</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">No issues flagged</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {asset.safetyStatus === 'needs_manual_review' ? (
                          <button
                            onClick={() => {
                              setSelectedAsset(asset);
                              setOverrideReason('');
                              setOverrideError(null);
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs shadow-xs transition-all inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review &amp; Override
                          </button>
                        ) : asset.safetyStatus === 'blocked' ? (
                          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                            Hard-Blocked (No Override)
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                            Cleared
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 bg-white dark:bg-slate-900/40">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Queue Empty</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No assets currently in &ldquo;{activeTab}&rdquo; state.
          </p>
        </div>
      )}

      {/* MANUAL REVIEW & OVERRIDE MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  Manual Safety Override Review
                </h2>
                <p className="text-[11px] text-slate-500 font-mono">Asset ID: {selectedAsset.id}</p>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {overrideError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {overrideError}
              </div>
            )}

            <div className="aspect-video bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
              {selectedAsset.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selectedAsset.url} alt="Review Media" className="w-full h-full object-contain" />
              ) : (
                <FileCheck className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-semibold block">Classifier Flagged Reasons:</span>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                {selectedAsset.safetyReasons ? (
                  (JSON.parse(selectedAsset.safetyReasons) as string[]).map((r, i) => (
                    <p key={i} className="text-slate-700 dark:text-slate-300 text-[11px]">• {r}</p>
                  ))
                ) : (
                  <p className="text-slate-400">None</p>
                )}
              </div>
            </div>

            <form onSubmit={handleApproveOverride} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Mandatory Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                  placeholder="Explain why this borderline asset is fully SFW and complies with all Section 2 persona rules..."
                />
                <p className="text-[11px] text-slate-500">
                  Section 2 Guardrail 7: This justification is permanently recorded in the AuditLog.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overriding || overrideReason.trim().length < 5}
                  className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {overriding ? 'Approving...' : 'Approve & Pass Safety Gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
