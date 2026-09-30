'use client';

import React, { useEffect, useState } from 'react';
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Key,
  Play,
  Lock,
  X,
  Save,
} from 'lucide-react';

interface PlatformAccountItem {
  id: string;
  platform: string;
  handle: string;
  apiStatus: string;
  hasToken: boolean;
  disclosureInBio: boolean;
  lastVerifiedAt: string | null;
  persona: {
    name: string;
    adultAge: number;
  };
}

interface DueVariantItem {
  id: string;
  caption: string;
  scheduledAt: string | null;
  platformAccount: {
    platform: string;
    handle: string;
  };
  post: {
    concept: string;
    status: string;
  };
}

export default function PublishingPage() {
  const [accounts, setAccounts] = useState<PlatformAccountItem[]>([]);
  const [dueVariants, setDueVariants] = useState<DueVariantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Worker Run State
  const [runningWorker, setRunningWorker] = useState(false);
  const [workerResult, setWorkerResult] = useState<string | null>(null);

  // Account Edit Modal
  const [editingAccount, setEditingAccount] = useState<PlatformAccountItem | null>(null);
  const [editHandle, setEditHandle] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editDisclosureInBio, setEditDisclosureInBio] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [accRes, calRes] = await Promise.all([
          fetch('/api/publishing/accounts'),
          fetch('/api/posts/calendar'),
        ]);

        const accData = await accRes.json();
        const calData = await calRes.json();

        if (isMounted) {
          if (accData.accounts) setAccounts(accData.accounts);
          if (calData.variants) {
            setDueVariants(calData.variants.slice(0, 10));
          }
        }
      } catch (err) {
        console.error('Failed to load publishing data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleRunWorker = async () => {
    setRunningWorker(true);
    setWorkerResult(null);

    try {
      const res = await fetch('/api/publishing/worker', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Worker run failed');

      setWorkerResult(
        `Worker completed! Processed: ${data.result.processed}, Succeeded: ${data.result.succeeded}, Failed: ${data.result.failed}`
      );
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setWorkerResult(`Error: ${err instanceof Error ? err.message : 'Execution failed'}`);
    } finally {
      setRunningWorker(false);
    }
  };

  const handlePublishNow = async (variantId: string) => {
    try {
      const res = await fetch('/api/publishing/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');

      alert(`Published successfully! External ID: ${data.result.externalId}`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(`Publish Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const openAccountModal = (acc: PlatformAccountItem) => {
    setEditingAccount(acc);
    setEditHandle(acc.handle);
    setEditToken('');
    setEditDisclosureInBio(acc.disclosureInBio);
    setEditError(null);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSavingAccount(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/publishing/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: editHandle,
          rawToken: editToken ? editToken.trim() : undefined,
          disclosureInBio: editDisclosureInBio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      setEditingAccount(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Publishing &amp; Platform Adapters</h1>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
              Automated &amp; Assisted Publishing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official platform APIs, encrypted token vaults, and automated queue worker with retry handling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunWorker}
            disabled={runningWorker}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Play className={`w-3.5 h-3.5 ${runningWorker ? 'animate-spin' : ''}`} />
            {runningWorker ? 'Processing Queue...' : 'Trigger Queue Worker'}
          </button>
        </div>
      </div>

      {/* Guardrail 8 & 3 Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-slate-300">
            <span className="font-semibold text-white">Section 2 Guardrail 8 Enforced:</span> Official APIs only. Where platforms lack direct APIs (TikTok, Reddit), the system uses verified manual-assist queues. Zero scrapers or unauthorized automation bots.
          </p>
        </div>
        <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/60 px-2 py-1 rounded border border-cyan-500/30 shrink-0">
          AES-256-GCM Token Vault
        </span>
      </div>

      {workerResult && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs flex items-center justify-between">
          <span>{workerResult}</span>
          <button onClick={() => setWorkerResult(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Platform Adapters Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white">Connected Publishing Accounts</h2>
        {loading ? (
          <div className="text-xs text-slate-400 py-8 text-center">Loading platform adapters...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white capitalize">{acc.platform}</span>
                      <span
                        className={`px-2 py-0.2 rounded text-[9px] font-mono uppercase font-bold ${
                          acc.apiStatus === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {acc.apiStatus}
                      </span>
                    </div>

                    <button
                      onClick={() => openAccountModal(acc)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-[11px]"
                      title="Edit Credentials"
                    >
                      Configure
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">Account Handle:</span>
                      <span className="font-mono text-slate-200">{acc.handle}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">API Vault Token:</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                        <Lock className="w-3 h-3 text-cyan-400" />
                        {acc.hasToken ? 'Encrypted (AES-GCM)' : 'Not Set (Sandbox)'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">AI Disclosure in Bio:</span>
                      <span
                        className={`flex items-center gap-1 font-medium text-[11px] ${
                          acc.disclosureInBio ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {acc.disclosureInBio ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Verified in Profile
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Missing Disclosure
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Persona: {acc.persona?.name}</span>
                  <span>{acc.lastVerifiedAt ? `Verified: ${new Date(acc.lastVerifiedAt).toLocaleDateString()}` : 'Unverified'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Queue Dispatcher Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Upcoming Publishing Queue</h2>
          <span className="text-xs text-slate-400">{dueVariants.length} scheduled</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3.5 font-semibold">Scheduled Date</th>
                  <th className="p-3.5 font-semibold">Platform</th>
                  <th className="p-3.5 font-semibold">Concept</th>
                  <th className="p-3.5 font-semibold">Caption Preview</th>
                  <th className="p-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {dueVariants.length > 0 ? (
                  dueVariants.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/60 transition-all">
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Immediate'}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800 text-[10px] font-mono capitalize">
                          {item.platformAccount?.platform}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-200 truncate max-w-xs">
                        {item.post?.concept}
                      </td>
                      <td className="p-3.5 text-slate-400 truncate max-w-md">
                        {item.caption}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handlePublishNow(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs inline-flex items-center gap-1 shadow"
                        >
                          <Send className="w-3 h-3" />
                          Publish Now
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No posts currently scheduled. Use the Composer to schedule variants.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CONFIGURE CREDENTIALS MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white capitalize">
                Configure {editingAccount.platform} Credentials
              </h2>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-200">Account Handle</label>
                <input
                  type="text"
                  required
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-200 flex items-center gap-1">
                    <Key className="w-3 h-3 text-cyan-400" />
                    Access Token / API Secret
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">AES-256-GCM Encrypted</span>
                </div>
                <input
                  type="password"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  placeholder={editingAccount.hasToken ? '•••••••••••••••• (Leave blank to keep current)' : 'Paste official API token...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Tokens are encrypted with AES-256-GCM before writing to the database. Never store account passwords.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDisclosureInBio}
                    onChange={(e) => setEditDisclosureInBio(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <span className="font-semibold text-slate-200 text-xs">
                    I confirm AI disclosure is visible in account bio
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 pl-5">
                  Section 2 Guardrail 3 requires AI disclosure on every social profile.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingAccount ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
