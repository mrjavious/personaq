'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MousePointerClick,
  Sparkles,
  Download,
  Upload,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Camera,
  Share2,
  AtSign,
  Video,
  HeartHandshake,
  Bot,
  RefreshCw,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import type { AnalyticsOverviewResult } from '@/lib/analytics/service';

export default function AnalyticsDashboardPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fetchAnalytics = async (selectedDays: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/analytics?days=${selectedDays}`);
      const json = await res.json();
      if (json.analytics) {
        setData(json.analytics);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
  }, [days]);

  const handleGenerateAiSummary = async () => {
    try {
      setGeneratingAi(true);
      const res = await fetch('/api/analytics/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (json.summary) {
        setAiSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    try {
      setImporting(true);
      setImportStatus(null);

      const res = await fetch('/api/analytics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to import CSV');
      }

      setImportStatus(json.message || 'Import successful!');
      setCsvText('');
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus(null);
        fetchAnalytics(days);
      }, 1500);
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : 'Error importing CSV');
    } finally {
      setImporting(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Camera className="w-4 h-4 text-pink-400" />;
      case 'x':
        return <Share2 className="w-4 h-4 text-sky-400" />;
      case 'threads':
        return <AtSign className="w-4 h-4 text-indigo-400" />;
      case 'tiktok':
        return <Video className="w-4 h-4 text-cyan-400" />;
      case 'fanvue':
        return <HeartHandshake className="w-4 h-4 text-amber-400" />;
      default:
        return <BarChart3 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Analytics &amp; Funnel Insights</h1>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
              Phase 5: Funnel Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end performance tracking from SFW social reach to Fanvue creator monetization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === 7 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === 30 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDays(90)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === 90 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              90 Days
            </button>
          </div>

          {/* CSV Tools */}
          <a
            href="/api/analytics/export"
            download
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Export CSV
          </a>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700"
            title="Import CSV"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            Import CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs">Aggregating platform metrics and funnel attribution...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Audience Base</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {data.totals.followers.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">Across 5 linked platforms</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Social Impressions</span>
                <Eye className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {data.totals.impressions.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Organic reach ({data.dateRange})
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Engagements</span>
                <BarChart3 className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {data.totals.engagement.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Avg. rate:{' '}
                {data.totals.impressions > 0
                  ? ((data.totals.engagement / data.totals.impressions) * 100).toFixed(1)
                  : '0'}
                %
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Funnel Clicks</span>
                <MousePointerClick className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {data.totals.clicks.toLocaleString()}
              </div>
              <div className="text-[11px] text-indigo-400 font-medium">
                Bio-link &amp; UTM tracked
              </div>
            </div>
          </div>

          {/* Funnel Stage Visualization */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Creator Monetization Conversion Funnel
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tracks conversion trajectory from compliant SFW social channels to external creator tier.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
                  Hub CTR: {data.funnel.hubCtr}%
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-300 text-xs font-medium border border-pink-500/20">
                  Fanvue Conv.: {data.funnel.fanvueConversionRate}%
                </span>
              </div>
            </div>

            {/* Funnel Visual Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
              {/* Step 1: SFW Reach */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Step 1: SFW Social Channels
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {data.funnel.sfwReach.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400">
                  Impressions on Instagram, X, Threads, TikTok
                </p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-indigo-500 h-full w-full" />
                </div>
              </div>

              {/* Step 2: Neutral Link Hub */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Step 2: Neutral Link Hub (/l/aria)
                </div>
                <div className="text-xl font-bold text-indigo-300 font-mono">
                  {data.funnel.hubClicks.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400">
                  Bio traffic &amp; post clicks ({data.funnel.hubCtr}% conversion)
                </p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(8, data.funnel.hubCtr * 10))}%` }}
                  />
                </div>
              </div>

              {/* Step 3: Fanvue Outbound */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Step 3: Fanvue Destination
                </div>
                <div className="text-xl font-bold text-pink-400 font-mono">
                  {data.funnel.fanvueConversions.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400">
                  Outbound creator tier clicks ({data.funnel.fanvueConversionRate}% conversion)
                </p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-pink-500 h-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(12, data.funnel.fanvueConversionRate))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI Weekly Summary Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">AI Executive Funnel Summary</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded border border-indigo-500/30">
                  Gemini 2.5 Flash / Ollama
                </span>
              </div>

              <button
                onClick={handleGenerateAiSummary}
                disabled={generatingAi}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generatingAi ? 'Generating Analysis...' : 'Generate Strategic Analysis'}
              </button>
            </div>

            {aiSummary ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                {aiSummary}
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Click above to synthesize multi-platform reach, engagement velocity, and Fanvue conversion drop-offs into strategic growth recommendations tailored for Aria Nova.
              </p>
            )}
          </div>

          {/* Platform Performance Cards */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Platform Performance Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.platforms.map((p) => (
                <div
                  key={p.platform}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                        {getPlatformIcon(p.platform)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs capitalize">{p.platform}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.handle}</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {p.engagementRate}% ER
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">Followers</div>
                      <div className="font-mono text-slate-200 font-semibold">
                        {p.followers.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Impressions</div>
                      <div className="font-mono text-slate-200 font-semibold">
                        {p.impressions.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Clicks</div>
                      <div className="font-mono text-indigo-300 font-semibold">
                        {p.clicks.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performing Posts */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Top Performing Posts</h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Concept</th>
                    <th className="p-3.5 font-semibold">Platform</th>
                    <th className="p-3.5 font-semibold">Published</th>
                    <th className="p-3.5 font-semibold">Est. Reach</th>
                    <th className="p-3.5 font-semibold">Est. Engagements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.topPosts.length > 0 ? (
                    data.topPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-slate-900/60 transition-all">
                        <td className="p-3.5 font-medium text-white max-w-[240px] truncate">
                          {post.concept}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 uppercase font-semibold">
                            {post.platform}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-400">
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString()
                            : 'Recent'}
                        </td>
                        <td className="p-3.5 font-mono text-purple-300">
                          {post.estimatedReach.toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono text-emerald-400">
                          {post.estimatedEngagement.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        No published posts found yet. Schedule posts via Composer to populate metrics!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                Import Analytics Snapshot CSV
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste CSV data exported from Instagram Insights, X Analytics, or Fanvue creator dashboard.
              Format: <code className="text-indigo-300">Platform,Handle,Date,Followers,Impressions,Engagement,Clicks</code>
            </p>

            {importStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs ${
                  importStatus.includes('success')
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {importStatus}
              </div>
            )}

            <form onSubmit={handleImportCsv} className="space-y-4">
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Platform,Handle,Date,Followers,Impressions,Engagement,Clicks\ninstagram,@aria.nova.ai,2026-09-28,14200,68000,3100,540\nx,@arianova_ai,2026-09-28,8900,42000,1800,390`}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !csvText.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  {importing ? 'Importing...' : 'Parse & Save Snapshots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
