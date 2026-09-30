'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Sparkles,
  MousePointerClick,
  Tag,
  Share2,
  Lock,
  Layers,
  X,
} from 'lucide-react';
import { buildUtmUrl } from '@/lib/links/utm';

interface LinkHubItem {
  id: string;
  slug: string;
  destinationUrl: string;
  isNeutralLanding: boolean;
  createdAt: string;
  persona: { id: string; name: string };
  _count: { clickEvents: number };
}

interface ClickEventItem {
  id: string;
  link: { slug: string; destinationUrl: string };
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  ts: string;
}

export default function LinkHubPage() {
  const [activeTab, setActiveTab] = useState<'hubs' | 'builder' | 'events'>('hubs');
  const [links, setLinks] = useState<LinkHubItem[]>([]);
  const [clickEvents, setClickEvents] = useState<ClickEventItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // New Link Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newDestination, setNewDestination] = useState('https://fanvue.com/arianova');
  const [newNeutral, setNewNeutral] = useState(true);
  const [savingLink, setSavingLink] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // UTM Builder State
  const [selectedHub, setSelectedHub] = useState<string>('aria');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('bio_link');
  const [utmCampaign, setUtmCampaign] = useState('fall_showcase');
  const [utmContent, setUtmContent] = useState('post_01');

  // Privacy Purge State
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [linksRes, clicksRes] = await Promise.all([
          fetch('/api/links'),
          fetch('/api/links/export?format=json'),
        ]);

        const linksData = await linksRes.json();
        const clicksData = await clicksRes.json();

        if (isMounted) {
          if (linksData.links) {
            setLinks(linksData.links);
            if (linksData.links.length > 0 && !selectedHub) {
              setSelectedHub(linksData.links[0].slug);
            }
          }
          if (clicksData.clicks) {
            setClickEvents(clicksData.clicks);
          }
        }
      } catch (err) {
        console.error('Error fetching link hub data:', err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, selectedHub]);

  const generatedUrl = useMemo(() => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://personaq.local';
      const base = useCustomUrl
        ? customBaseUrl || 'https://fanvue.com/arianova'
        : `${origin}/l/${selectedHub || 'aria'}`;

      return buildUtmUrl(base, {
        utm_source: utmSource,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        utm_content: utmContent || undefined,
      });
    } catch {
      return '';
    }
  }, [selectedHub, useCustomUrl, customBaseUrl, utmSource, utmMedium, utmCampaign, utmContent]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug || !newDestination) return;

    try {
      setSavingLink(true);
      setCreateError(null);

      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: newSlug,
          destinationUrl: newDestination,
          isNeutralLanding: newNeutral,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create link hub');
      }

      setShowCreateModal(false);
      setNewSlug('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error creating link');
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteHub = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link hub and its click history?')) return;

    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error deleting link:', err);
    }
  };

  const handlePurgeClicks = async () => {
    if (!confirm('Confirm deletion of ALL tracked click records? This satisfies Section 7 privacy data erasure.')) {
      return;
    }

    try {
      setPurging(true);
      const res = await fetch('/api/links/clicks', { method: 'DELETE' });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error purging clicks:', err);
    } finally {
      setPurging(false);
    }
  };

  const totalClicks = clickEvents.length;
  const platformClicks = clickEvents.reduce<Record<string, number>>((acc, curr) => {
    const src = curr.utmSource || 'direct';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  const campaignClicks = clickEvents.reduce<Record<string, number>>((acc, curr) => {
    const cmp = curr.utmCampaign || 'organic';
    acc[cmp] = (acc[cmp] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Link Hub &amp; UTM Funnel</h1>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
              Funnel Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compliant neutral bio links, UTM tracking builder, and privacy-respecting funnel analytics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('hubs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'hubs'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Bio Hubs ({links.length})
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'builder'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            UTM Link Builder
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'events'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            Funnel Clicks ({totalClicks})
          </button>
        </div>
      </div>

      {/* TAB 1: BIO HUBS */}
      {activeTab === 'hubs' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Section 5.7 Neutral Bio Policy:</span> Neutral landing hubs keep bio-link destinations safe on Instagram, X, Threads, and TikTok while smoothly funneled to creator platforms.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Bio Link Hub
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {links.map((link) => {
              const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/l/${link.slug}` : `/l/${link.slug}`;
              return (
                <div
                  key={link.id}
                  className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-mono text-xs font-bold">
                          /{link.slug}
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          /l/{link.slug}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-medium">
                        {link.isNeutralLanding ? 'Neutral Landing' : 'Direct Redirect'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Target Destination:</span>
                        <a
                          href={link.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 max-w-[180px] truncate"
                        >
                          {link.destinationUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Persona:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{link.persona.name}</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Total Clicks:</span>
                        <span className="text-indigo-600 dark:text-indigo-300 font-bold font-mono">
                          {link._count?.clickEvents || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(fullUrl, link.id)}
                        className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-all"
                      >
                        {copiedText === link.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </button>
                      <a
                        href={`/l/${link.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs flex items-center gap-1 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Preview
                      </a>
                    </div>

                    <button
                      onClick={() => handleDeleteHub(link.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                      title="Delete Link Hub"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: UTM LINK BUILDER */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs transition-colors">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Multi-Platform UTM Link Generator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Construct fully tagged attribution links to track conversion funnels from social posts to your monetization destination.
              </p>
            </div>

            <div className="space-y-4">
              {/* Target Hub Link or Custom */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Base Destination</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomUrl}
                      onChange={(e) => setUseCustomUrl(e.target.checked)}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600"
                    />
                    Use External Custom URL
                  </label>
                </div>

                {!useCustomUrl ? (
                  <select
                    value={selectedHub}
                    onChange={(e) => setSelectedHub(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  >
                    {links.map((link) => (
                      <option key={link.id} value={link.slug}>
                        /l/{link.slug} (Points to {link.destinationUrl})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="url"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://fanvue.com/arianova"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Source & Medium */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Platform (utm_source)
                  </label>
                  <select
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="x">X / Twitter</option>
                    <option value="threads">Threads</option>
                    <option value="tiktok">TikTok</option>
                    <option value="fanvue">Fanvue</option>
                    <option value="reddit">Reddit</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Placement Medium (utm_medium)
                  </label>
                  <select
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  >
                    <option value="bio_link">Bio Link</option>
                    <option value="post_caption">Post Caption</option>
                    <option value="story_sticker">Story Sticker</option>
                    <option value="dm_reply">Direct Message</option>
                    <option value="profile_button">Profile Button</option>
                  </select>
                </div>
              </div>

              {/* Campaign & Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Campaign Name (utm_campaign)
                  </label>
                  <input
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="e.g. neon_drop_v1, fall_gallery"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Content Identifier / Post ID (utm_content)
                  </label>
                  <input
                    type="text"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                    placeholder="e.g. post_cyber_04, variant_ig_01"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Generated URL Display */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Generated Attribution URL</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">UTM Compliant</span>
              </label>

              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="bg-transparent text-xs font-mono text-indigo-700 dark:text-indigo-300 w-full focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(generatedUrl, 'generated_utm')}
                  className="h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs shrink-0 transition-all"
                >
                  {copiedText === 'generated_utm' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy URL
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Attribution Preview & Architecture */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 transition-colors shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Funnel Architecture
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Posts on SFW social channels attach this URL in bio or stories. When a follower taps it, Persona Studio logs the click while honoring user privacy and passes the user to your monetization destination.
              </p>

              <div className="space-y-2 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target Platform:</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-300 capitalize">{utmSource}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Campaign:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{utmCampaign || 'None'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Content Tag:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{utmContent || 'None'}</span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Automatic Scheduler Injection
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                When scheduling variants in Composer, the system auto-populates this UTM link directly into the <code className="text-indigo-700 dark:text-indigo-300 font-mono">utmLink</code> field for each platform account!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FUNNEL CLICKS & PRIVACY VAULT */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 transition-colors shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Tracked Clicks</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{totalClicks}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero Fingerprinting / DNT Respected
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 transition-colors shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">Clicks by Platform Source</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(platformClicks).map(([src, count]) => (
                  <span
                    key={src}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]"
                  >
                    {src}: <strong className="text-indigo-600 dark:text-indigo-400">{count}</strong>
                  </span>
                ))}
                {Object.keys(platformClicks).length === 0 && (
                  <span className="text-xs text-slate-400">No clicks recorded yet</span>
                )}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 transition-colors shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">Clicks by Campaign</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(campaignClicks).map(([cmp, count]) => (
                  <span
                    key={cmp}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]"
                  >
                    {cmp}: <strong className="text-purple-600 dark:text-purple-400">{count}</strong>
                  </span>
                ))}
                {Object.keys(campaignClicks).length === 0 && (
                  <span className="text-xs text-slate-400">No campaigns recorded yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Privacy & Export Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Section 7 Privacy Guarantee:</span> Zero IP addresses or cookie tracking stored. Data export &amp; purge endpoints active.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/links/export?format=csv"
                download
                className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Export CSV
              </a>
              <button
                onClick={handlePurgeClicks}
                disabled={purging || totalClicks === 0}
                className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {purging ? 'Purging...' : 'Purge All Logs'}
              </button>
            </div>
          </div>

          {/* Click Events Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Timestamp</th>
                    <th className="p-3.5 font-semibold">Hub Slug</th>
                    <th className="p-3.5 font-semibold">Source</th>
                    <th className="p-3.5 font-semibold">Campaign</th>
                    <th className="p-3.5 font-semibold">Content</th>
                    <th className="p-3.5 font-semibold">Referrer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {clickEvents.length > 0 ? (
                    clickEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all">
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(evt.ts).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono text-indigo-600 dark:text-indigo-300">
                          /l/{evt.link.slug}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 uppercase font-semibold">
                            {evt.utmSource || 'direct'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-800 dark:text-slate-200">
                          {evt.utmCampaign || '—'}
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                          {evt.utmContent || '—'}
                        </td>
                        <td className="p-3.5 text-slate-500 max-w-[200px] truncate">
                          {evt.referrer || 'None (Direct / DNT)'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No funnel click events recorded yet. Share a UTM link from the builder to start measuring conversions!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BIO LINK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Create New Bio Link Hub</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateHub} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200">URL Slug</label>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-10">
                  <span className="text-slate-400 font-mono">/l/</span>
                  <input
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="aria-gallery"
                    className="bg-transparent text-slate-900 dark:text-white w-full focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Target Destination URL (e.g. Fanvue)
                </label>
                <input
                  type="url"
                  required
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  placeholder="https://fanvue.com/yourpersona"
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="neutralToggle"
                  checked={newNeutral}
                  onChange={(e) => setNewNeutral(e.target.checked)}
                  className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="neutralToggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Render neutral landing page (Recommended for Instagram/TikTok compliance)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLink}
                  className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs"
                >
                  {savingLink ? 'Creating...' : 'Create Link Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
