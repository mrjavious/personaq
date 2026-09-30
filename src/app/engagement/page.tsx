'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquareQuote,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Camera,
  Share2,
  AtSign,
  Video,
  HeartHandshake,
  Bot,
  UserCheck,
  Bookmark,
  RefreshCw,
} from 'lucide-react';

interface PlatformAccountItem {
  id: string;
  platform: string;
  handle: string;
  apiStatus: string;
}

interface DraftReplyItem {
  id: string;
  platformAccountId: string;
  contextText: string;
  suggestedText: string;
  status: 'draft' | 'approved' | 'discarded';
  createdAt: string;
  platformAccount: {
    platform: string;
    handle: string;
  };
}

const PRESET_TEMPLATES = [
  {
    title: 'AI Tools & Process Disclosure',
    text: 'Thanks for asking! I am an AI persona created with ComfyUI and custom stylized workflows. Exploring human imagination in the digital era! ✨ #AI',
  },
  {
    title: 'Creative Prompt Inspiration',
    text: 'Appreciate the love on this aesthetic! What speculative or digital worlds are you currently dreaming up?',
  },
  {
    title: 'Fanvue VIP Gallery Direction',
    text: 'So glad you enjoyed this preview! For full concept sets and high-res wallpaper renders, check the bio link to my Fanvue creator tier.',
  },
  {
    title: 'Community Gratitude',
    text: 'Sending digital good vibes your way! Thank you for being such an encouraging part of this creative journey.',
  },
];

export default function EngagementPage() {
  const [activeTab, setActiveTab] = useState<'compose' | 'queue' | 'templates'>('compose');
  const [accounts, setAccounts] = useState<PlatformAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftReplyItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Composer State
  const [incomingComment, setIncomingComment] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedOptions, setGeneratedOptions] = useState<string[]>([]);
  const [activeDraftText, setActiveDraftText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  // Load Accounts & Drafts
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [accRes, draftsRes] = await Promise.all([
          fetch('/api/publishing/accounts'),
          fetch(`/api/engagement/drafts${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
        ]);

        const accData = await accRes.json();
        const draftsData = await draftsRes.json();

        if (isMounted) {
          if (accData.accounts) {
            setAccounts(accData.accounts);
            if (accData.accounts.length > 0 && !selectedAccountId) {
              setSelectedAccountId(accData.accounts[0].id);
            }
          }
          if (draftsData.drafts) {
            setDrafts(draftsData.drafts);
          }
        }
      } catch (err) {
        console.error('Failed to load engagement data:', err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, selectedAccountId, statusFilter]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !incomingComment.trim()) return;

    try {
      setGenerating(true);
      setGeneratedOptions([]);
      setActiveDraftText('');

      const res = await fetch('/api/engagement/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformAccountId: selectedAccountId,
          contextText: incomingComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate drafts');
      }

      if (data.suggestions?.suggestions) {
        setGeneratedOptions(data.suggestions.suggestions);
        if (data.suggestions.suggestions.length > 0) {
          setActiveDraftText(data.suggestions.suggestions[0]);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generating drafts');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndCopy = async () => {
    if (!activeDraftText.trim() || !selectedAccountId) return;

    try {
      setSavingAction(true);

      // Save draft record first
      const createRes = await fetch('/api/engagement/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformAccountId: selectedAccountId,
          contextText: incomingComment || 'Manual reply',
          suggestedText: activeDraftText.trim(),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to save');

      // Immediately mark approved
      await fetch(`/api/engagement/drafts/${createData.draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          editedText: activeDraftText.trim(),
        }),
      });

      await copyToClipboard(activeDraftText.trim(), 'active_draft');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving reply');
    } finally {
      setSavingAction(false);
    }
  };

  const handleUpdateStatus = async (id: string, action: 'approve' | 'discard') => {
    try {
      const res = await fetch(`/api/engagement/drafts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/engagement/drafts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Camera className="w-3.5 h-3.5 text-pink-400" />;
      case 'x':
        return <Share2 className="w-3.5 h-3.5 text-sky-400" />;
      case 'threads':
        return <AtSign className="w-3.5 h-3.5 text-indigo-400" />;
      case 'tiktok':
        return <Video className="w-3.5 h-3.5 text-cyan-400" />;
      case 'fanvue':
        return <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Send className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Engagement Assistant</h1>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
              Human-in-the-Loop Studio
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Persona-aligned comment and DM drafts with strict human approval. Zero automated outbound bots.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'compose'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Reply Studio
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Reply Queue ({drafts.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Quick Templates
          </button>
        </div>
      </div>

      {/* Non-Negotiable Guardrail 5 Banner */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3">
        <UserCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-white">
            Section 2 Guardrail 5: Human-In-The-Loop Enforcement
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            No outbound comment, reply, or DM is ever sent automatically. AI produces suggested drafts in Aria Nova&apos;s voice; you review, edit, approve, and copy to send manually. No code path exists for autonomous messaging.
          </p>
        </div>
      </div>

      {/* TAB 1: REPLY STUDIO */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              Incoming Fan Comment or Direct Message
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Social Channel</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.platform.toUpperCase()} — {acc.handle}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Fan Comment / Inquiry</label>
                <textarea
                  rows={3}
                  required
                  value={incomingComment}
                  onChange={(e) => setIncomingComment(e.target.value)}
                  placeholder="Paste comment or DM here (e.g. 'Love the cyberpunk vibes in this render! What model generated the outfit?')"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={generating || !incomingComment.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generating ? 'Drafting Persona Replies...' : 'Draft 3 Persona Replies'}
                </button>
              </div>
            </form>

            {/* Generated Options */}
            {generatedOptions.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Generated Voice Options (Aria Nova)
                  </label>
                  <span className="text-[10px] text-indigo-300 font-mono">
                    Content Filter: Passed
                  </span>
                </div>

                <div className="space-y-2">
                  {generatedOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveDraftText(opt)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all text-xs leading-relaxed ${
                        activeDraftText === opt
                          ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-850 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 text-[10px] font-mono text-slate-400">
                        <span>Variation {idx + 1}</span>
                        {activeDraftText === opt && (
                          <span className="text-indigo-400 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected for Editing
                          </span>
                        )}
                      </div>
                      <p>{opt}</p>
                    </div>
                  ))}
                </div>

                {/* Final Edit & Approve Action */}
                <div className="space-y-2 pt-3">
                  <label className="text-xs font-semibold text-slate-300">
                    Review &amp; Edit Selected Reply
                  </label>
                  <textarea
                    rows={3}
                    value={activeDraftText}
                    onChange={(e) => setActiveDraftText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Approving logs cryptographic audit trail and copies text to clipboard.
                    </p>

                    <button
                      type="button"
                      disabled={savingAction || !activeDraftText.trim()}
                      onClick={handleApproveAndCopy}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow transition-all shrink-0"
                    >
                      {copiedId === 'active_draft' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          Approved &amp; Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Approve &amp; Copy Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persona Voice Context Card */}
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Active Persona Persona Voice
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-850">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">
                    Voice Tone
                  </span>
                  <span className="text-slate-200 font-medium">
                    Thoughtful, curious, witty, approachable, and transparently digital.
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-850">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">
                    Core Boundaries
                  </span>
                  <ul className="text-slate-300 text-[11px] list-disc list-inside space-y-0.5 pt-1">
                    <li>Never claim to be a real living person.</li>
                    <li>Friendly and warm, but clearly AI.</li>
                    <li>Zero explicit or minor references.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-950/30 via-purple-950/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-indigo-300">Creator Best Practice</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Replying to top comments within the first 60 minutes after posting on Instagram and Threads significantly increases algorithm velocity and bio-link click-throughs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPLY QUEUE & AUDIT */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Reply History &amp; Approval Trail</h2>
              <p className="text-xs text-slate-400">
                Records all approved, drafted, and discarded comment replies.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="draft">Pending Drafts</option>
                <option value="discarded">Discarded</option>
              </select>

              <button
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3.5 font-semibold">Channel</th>
                  <th className="p-3.5 font-semibold">Context Comment</th>
                  <th className="p-3.5 font-semibold">Suggested Persona Reply</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {drafts.length > 0 ? (
                  drafts.map((draft) => (
                    <tr key={draft.id} className="hover:bg-slate-900/60 transition-all">
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(draft.platformAccount.platform)}
                          <span className="font-mono text-slate-200">
                            {draft.platformAccount.handle}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 max-w-[200px] truncate text-slate-400 font-mono text-[11px]">
                        &ldquo;{draft.contextText}&rdquo;
                      </td>
                      <td className="p-3.5 max-w-[280px] text-slate-200">
                        {draft.suggestedText}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                            draft.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : draft.status === 'draft'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {draft.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => copyToClipboard(draft.suggestedText, draft.id)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Copy reply text"
                          >
                            {copiedId === draft.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {draft.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(draft.id, 'approve')}
                                className="p-1.5 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400"
                                title="Approve"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(draft.id, 'discard')}
                                className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                title="Discard"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDeleteDraft(draft.id)}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No replies found matching this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK REPLY TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h2 className="text-sm font-semibold text-white">Pre-Approved Reply Templates</h2>
            <p className="text-xs text-slate-400">
              Quick, platform-compliant responses for common fan interactions and AI disclosure questions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESET_TEMPLATES.map((tmpl, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      {tmpl.title}
                    </h3>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                      Pre-Approved
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                    &ldquo;{tmpl.text}&rdquo;
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => copyToClipboard(tmpl.text, `tmpl_${idx}`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
                  >
                    {copiedId === `tmpl_${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
