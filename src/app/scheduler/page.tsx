'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  PenTool,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Send,
  Download,
  Share2,
  Calendar,
  X,
} from 'lucide-react';
import { validatePostVariantSuitability } from '@/lib/guardrails/rules';

interface AssetItem {
  id: string;
  url: string | null;
  suitability: string;
  safetyStatus: string;
  tags: string | null;
}

interface PlatformAccountItem {
  id: string;
  platform: string;
  handle: string;
  apiStatus: string;
}

interface PostItem {
  id: string;
  concept: string;
  status: string;
  createdAt: string;
  variants: {
    id: string;
    caption: string;
    hashtags: string;
    aiLabelApplied: boolean;
    scheduledAt: string | null;
    publishedAt: string | null;
    asset?: AssetItem | null;
    platformAccount: {
      platform: string;
      handle: string;
    };
  }[];
}

interface CalendarVariantItem {
  id: string;
  caption: string;
  scheduledAt: string | null;
  post: {
    concept: string;
    status: string;
  };
  platformAccount: {
    platform: string;
    handle: string;
  };
}

interface CaptionOption {
  tone: string;
  caption: string;
  hashtags: string[];
  altText: string;
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', maxChars: 2200, isSfw: true },
  { id: 'x', label: 'X (Twitter)', maxChars: 280, isSfw: true },
  { id: 'threads', label: 'Threads', maxChars: 500, isSfw: true },
  { id: 'tiktok', label: 'TikTok', maxChars: 2200, isSfw: true },
  { id: 'fanvue', label: 'Fanvue', maxChars: 5000, isSfw: false },
];

export default function SchedulerPage() {
  const [activeTab, setActiveTab] = useState<'composer' | 'calendar' | 'manual_assist'>('composer');
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccountItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [calendarVariants, setCalendarVariants] = useState<CalendarVariantItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Composer State
  const [concept, setConcept] = useState('Cyberpunk street fashion & architectural worldbuilding');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [activePlatformTab, setActivePlatformTab] = useState('instagram');
  const [variantCaptions, setVariantCaptions] = useState<Record<string, string>>({
    instagram: '',
    x: '',
    threads: '',
    tiktok: '',
    fanvue: '',
  });
  const [variantHashtags, setVariantHashtags] = useState<Record<string, string[]>>({
    instagram: ['#CyberpunkFashion', '#DigitalPersona', '#NeoArcadia', '#AIArt'],
    x: ['#AI', '#NeoArcadia'],
    threads: ['#Techwear', '#SyntheticArt'],
    tiktok: ['#cyberpunk', '#aiartist', '#virtualfashion'],
    fanvue: ['#exclusive', '#ariavault'],
  });
  const [scheduledDates, setScheduledDates] = useState<Record<string, string>>({
    instagram: '',
    x: '',
    threads: '',
    tiktok: '',
    fanvue: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [composerSuccess, setComposerSuccess] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiOptions, setAiOptions] = useState<CaptionOption[]>([]);

  // Manual Assist Clipboard feedback
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [assetsRes, accountsRes, postsRes, calRes] = await Promise.all([
          fetch('/api/assets'),
          fetch('/api/publishing/accounts'),
          fetch('/api/posts'),
          fetch('/api/posts/calendar'),
        ]);

        const assetsData = await assetsRes.json();
        const accountsData = await accountsRes.json();
        const postsData = await postsRes.json();
        const calData = await calRes.json();

        if (isMounted) {
          if (assetsData.assets) setAssets(assetsData.assets);
          if (accountsData.accounts) setAccounts(accountsData.accounts);
          if (postsData.posts) setPosts(postsData.posts);
          if (calData.variants) setCalendarVariants(calData.variants);

          if (assetsData.assets?.length > 0 && !selectedAssetId) {
            setSelectedAssetId(assetsData.assets[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load scheduler data:', err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, selectedAssetId]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const currentSuitabilityCheck = validatePostVariantSuitability(
    activePlatformTab,
    selectedAsset?.suitability
  );

  const handleGenerateCaptions = async () => {
    setIsAiModalOpen(true);
    setGeneratingAi(true);
    setAiOptions([]);

    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept,
          platform: activePlatformTab,
          assetDescription: selectedAsset ? 'Stylized digital persona portrait' : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate captions');

      if (data.result?.options) {
        setAiOptions(data.result.options);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI generation error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleApplyAiOption = (option: CaptionOption) => {
    setVariantCaptions((prev) => ({
      ...prev,
      [activePlatformTab]: option.caption,
    }));
    if (option.hashtags && option.hashtags.length > 0) {
      setVariantHashtags((prev) => ({
        ...prev,
        [activePlatformTab]: option.hashtags,
      }));
    }
    setIsAiModalOpen(false);
  };

  const handleSavePost = async (status: 'draft' | 'scheduled') => {
    setComposerError(null);
    setSubmitting(true);
    setComposerSuccess(false);

    try {
      const variantsToSave = PLATFORMS.map((plat) => {
        const account = accounts.find((a) => a.platform === plat.id) || {
          id: accounts[0]?.id || 'default_account',
          platform: plat.id,
        };

        return {
          platformAccountId: account.id,
          platform: plat.id,
          assetId: selectedAssetId || null,
          caption:
            variantCaptions[plat.id] ||
            `✨ ${concept}\n\n#AI #DisclosedAI`,
          hashtags: variantHashtags[plat.id] || [],
          aiLabelApplied: true,
          scheduledAt: scheduledDates[plat.id] || (status === 'scheduled' ? new Date().toISOString() : null),
        };
      });

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept,
          status,
          variants: variantsToSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      setComposerSuccess(true);
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setComposerSuccess(false), 3000);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Save post failed');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPostId(id);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Content Engine &amp; Scheduler</h1>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
              Multi-Platform Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compose concepts, generate AI captions with provider fallback, enforce asset suitability, and schedule across platforms.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('composer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'composer'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Composer
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar ({calendarVariants.length})
          </button>
          <button
            onClick={() => setActiveTab('manual_assist')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'manual_assist'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Manual-Assist
          </button>
        </div>
      </div>

      {/* TAB 1: COMPOSER */}
      {activeTab === 'composer' && (
        <div className="space-y-6">
          {composerError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{composerError}</span>
            </div>
          )}

          {composerSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Post and multi-platform variants successfully created and scheduled!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Concept & Asset Selection */}
            <div className="space-y-5 lg:col-span-1">
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 transition-colors">
                <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                  1. Concept &amp; Attached Asset
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Post Concept Theme</label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                    placeholder="e.g. Cyberpunk architecture workflow"
                  />
                </div>

                {/* Asset Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex justify-between">
                    <span>Attached Asset</span>
                    <span className="text-[11px] text-slate-500 font-normal">{assets.length} available</span>
                  </label>

                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`aspect-square rounded-lg border overflow-hidden relative cursor-pointer transition-all ${
                          selectedAssetId === asset.id
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                        }`}
                      >
                        {asset.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={asset.url} alt="Thumb" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-[10px] text-slate-400">
                            Asset
                          </div>
                        )}
                        <span
                          className={`absolute top-1 left-1 px-1 rounded text-[8px] font-bold ${
                            asset.suitability === 'adult_only' ? 'bg-purple-900 text-white' : 'bg-emerald-800 text-white'
                          }`}
                        >
                          {asset.suitability === 'adult_only' ? '18+' : 'SFW'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedAsset && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Class:</span>
                        <span
                          className={`font-semibold ${
                            selectedAsset.suitability === 'adult_only' ? 'text-purple-700 dark:text-purple-300' : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {selectedAsset.suitability === 'adult_only' ? 'Adult Only (18+)' : 'SFW Safe'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Safety Gate:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{selectedAsset.safetyStatus}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2 Guardrail 4 Alert */}
                {!currentSuitabilityCheck.valid && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/50 rounded-xl text-purple-900 dark:text-purple-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                      <Lock className="w-4 h-4" />
                      Section 2 Guardrail 4 Active:
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      &apos;adult_only&apos; asset cannot be scheduled to SFW platform &apos;{activePlatformTab}&apos;. Switch to the Fanvue tab or select an SFW-safe asset.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Platform Variants & AI Assistant */}
            <div className="space-y-5 lg:col-span-2">
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    2. Multi-Platform Variant Customization
                  </h2>

                  <button
                    onClick={handleGenerateCaptions}
                    className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Caption Assistant (3 Tones)
                  </button>
                </div>

                {/* Platform Sub-tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {PLATFORMS.map((plat) => {
                    const isBlocked = selectedAsset?.suitability === 'adult_only' && plat.isSfw;
                    return (
                      <button
                        key={plat.id}
                        onClick={() => setActivePlatformTab(plat.id)}
                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          activePlatformTab === plat.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {isBlocked && <Lock className="w-3 h-3 text-purple-400" />}
                        {plat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Active Platform Editor */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-slate-800 dark:text-slate-200">
                        Caption for {PLATFORMS.find((p) => p.id === activePlatformTab)?.label}
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">
                        {(variantCaptions[activePlatformTab] || '').length} /{' '}
                        {PLATFORMS.find((p) => p.id === activePlatformTab)?.maxChars} chars
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={variantCaptions[activePlatformTab] || ''}
                      onChange={(e) =>
                        setVariantCaptions({
                          ...variantCaptions,
                          [activePlatformTab]: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                      placeholder={`Write or generate a captivating caption for ${activePlatformTab}...`}
                    />
                  </div>

                  {/* Scheduled Date Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Schedule Publishing Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDates[activePlatformTab] || ''}
                        onChange={(e) =>
                          setScheduledDates({
                            ...scheduledDates,
                            [activePlatformTab]: e.target.value,
                          })
                        }
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        AI Disclosure Applied
                      </label>
                      <div className="h-10 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">AI-generated label will be attached on publish</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSavePost('draft')}
                    className="h-10 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !currentSuitabilityCheck.valid}
                    onClick={() => handleSavePost('scheduled')}
                    className={`h-10 px-5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs ${
                      currentSuitabilityCheck.valid
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Saving Post...' : 'Schedule Across Platforms'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Publishing Calendar</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled posts across Instagram, X, Threads, TikTok, and Fanvue.</p>
            </div>
            <button
              onClick={() => setActiveTab('composer')}
              className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <PenTool className="w-3.5 h-3.5" />
              New Post
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        post.status === 'scheduled'
                          ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40'
                          : post.status === 'published'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{post.concept}</h3>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Active Platform Variants:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {post.variants.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[10px] font-mono capitalize"
                        >
                          {v.platformAccount.platform}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs bg-white dark:bg-slate-900/40">
                No scheduled posts yet. Compose your first concept above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MANUAL ASSIST QUEUE */}
      {activeTab === 'manual_assist' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition-colors">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Manual-Assist Queue</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For platforms without direct official posting APIs (e.g. TikTok or unlinked channels). Copy caption, download media, and mark posted.
            </p>
          </div>

          <div className="space-y-4">
            {posts
              .flatMap((p) => p.variants)
              .filter((v) => v.platformAccount.platform === 'tiktok' || v.platformAccount.platform === 'fanvue')
              .map((variant) => (
                <div
                  key={variant.id}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors shadow-2xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold uppercase">
                        {variant.platformAccount.platform}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{variant.platformAccount.handle}</span>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800 line-clamp-3">
                      {variant.caption}
                    </p>

                    <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Reminder: Ensure &ldquo;AI-generated content&rdquo; switch is toggled ON before publishing.</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(variant.caption, variant.id)}
                      className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      {copiedPostId === variant.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPostId === variant.id ? 'Copied!' : 'Copy Caption'}
                    </button>

                    {variant.asset?.url && (
                      <a
                        href={variant.asset.url}
                        download
                        className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all text-center justify-center border border-slate-200 dark:border-slate-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Media
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* AI CAPTION MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Caption Assistant</h2>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {generatingAi ? (
              <div className="py-12 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Generating 3 distinct captions in persona voice...
                </p>
                <p className="text-[11px] text-slate-500">
                  Attempting Gemini 2.5 Flash with fallback to local Ollama.
                </p>
              </div>
            ) : aiOptions.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Select a caption option to automatically apply it to the &apos;{activePlatformTab}&apos; variant:
                </p>

                <div className="space-y-3">
                  {aiOptions.map((opt, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase">
                          {opt.tone}
                        </span>
                        <button
                          onClick={() => handleApplyAiOption(opt)}
                          className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs"
                        >
                          Apply to {activePlatformTab}
                        </button>
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{opt.caption}</p>

                      {opt.hashtags.length > 0 && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          {opt.hashtags.join(' ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                No captions generated yet.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
