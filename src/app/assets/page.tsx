'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Image as ImageIcon,
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Sparkles,
  Bot,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  X,
  FileCheck,
  RefreshCw,
  CheckSquare,
  Square,
  User,
} from 'lucide-react';

interface AssetItem {
  id: string;
  storageKey: string;
  url: string | null;
  type: string;
  suitability: 'sfw_safe' | 'adult_only' | string;
  aiGenerated: boolean;
  provenanceMeta: string | null;
  safetyStatus: 'passed' | 'blocked' | 'needs_manual_review' | 'pending' | string;
  safetyReasons: string | null;
  tags: string | null;
  createdAt: string;
}

interface PersonaOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
  adultAge?: number;
}

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suitabilityFilter, setSuitabilityFilter] = useState('all');
  const [safetyFilter, setSafetyFilter] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Persona Selection State (Filter strictly by selected persona)
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');

  // Asset Selection & Deletion State
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<'batch' | AssetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSuitability, setUploadSuitability] = useState<'sfw_safe' | 'adult_only'>('sfw_safe');
  const [uploadTags, setUploadTags] = useState('portrait, studio, techwear');
  const [uploadPrompt, setUploadPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inspect Modal State
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);

  // ComfyUI Modal State
  const [isComfyOpen, setIsComfyOpen] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: 'Checking ComfyUI...',
  });
  const [comfyPrompt, setComfyPrompt] = useState('casual coffee shop setting, warm sunlight, neon reflections');
  const [comfyAspectRatio, setComfyAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [queuingComfy, setQueuingComfy] = useState(false);
  const [comfyResult, setComfyResult] = useState<string | null>(null);

  // 1. Fetch available personas on load
  useEffect(() => {
    async function loadPersonas() {
      try {
        const res = await fetch('/api/persona?all=true');
        const data = await res.json();
        const list: PersonaOption[] = data.allPersonas || data.personas || (data.persona ? [data.persona] : []);
        if (list.length > 0) {
          setPersonas(list);
          const searchParams = new URLSearchParams(window.location.search);
          const paramId = searchParams.get('personaId');
          const matched = list.find((p) => p.id === paramId);
          setSelectedPersonaId(matched ? matched.id : list[0].id);
        }
      } catch (err) {
        console.error('Failed to load personas in Asset Library:', err);
      }
    }
    loadPersonas();
  }, []);

  // 2. Fetch assets exclusively for the selected persona
  useEffect(() => {
    if (!selectedPersonaId) return;
    let isMounted = true;

    async function fetchAssets() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('personaId', selectedPersonaId);
        if (suitabilityFilter !== 'all') params.set('suitability', suitabilityFilter);
        if (safetyFilter !== 'all') params.set('safetyStatus', safetyFilter);

        const res = await fetch(`/api/assets?${params.toString()}`);
        const data = await res.json();
        if (isMounted && data.assets) {
          setAssets(data.assets);
          setTotal(data.total);
          // Preserve valid selected ids
          setSelectedAssetIds((prev) => {
            const currentIds = new Set(data.assets.map((a: AssetItem) => a.id));
            const next = new Set<string>();
            prev.forEach((id) => {
              if (currentIds.has(id)) next.add(id);
            });
            return next;
          });
        }
      } catch (err) {
        console.error('Error fetching assets:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAssets();

    return () => {
      isMounted = false;
    };
  }, [selectedPersonaId, suitabilityFilter, safetyFilter, refreshTrigger]);

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssetIds.size === assets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(assets.map((a) => a.id)));
    }
  };

  const clearSelection = () => {
    setSelectedAssetIds(new Set());
  };

  const checkComfy = async () => {
    try {
      const res = await fetch('/api/comfyui/status');
      const data = await res.json();
      setComfyStatus({
        connected: data.connected,
        message: data.connected ? 'ComfyUI Server Connected (:8188)' : 'ComfyUI Offline / Simulated Mode',
      });
    } catch {
      setComfyStatus({ connected: false, message: 'ComfyUI Server Offline' });
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (selectedPersonaId) {
        formData.append('personaId', selectedPersonaId);
      }
      formData.append('suitability', uploadSuitability);
      formData.append('tags', uploadTags);
      formData.append('prompt', uploadPrompt);

      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload asset');
      }

      setIsUploadOpen(false);
      setUploadFile(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmTarget) return;
    setDeleting(true);
    try {
      if (deleteConfirmTarget === 'batch') {
        const ids = Array.from(selectedAssetIds);
        if (ids.length === 0) return;
        const res = await fetch('/api/assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          setSelectedAssetIds(new Set());
          setRefreshTrigger((prev) => prev + 1);
        }
      } else {
        const res = await fetch(`/api/assets/${deleteConfirmTarget.id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          if (selectedAsset?.id === deleteConfirmTarget.id) {
            setSelectedAsset(null);
          }
          setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            next.delete(deleteConfirmTarget.id);
            return next;
          });
          setRefreshTrigger((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Failed to delete asset(s):', err);
    } finally {
      setDeleting(false);
      setDeleteConfirmTarget(null);
    }
  };

  const handleQueueComfy = async (e: React.FormEvent) => {
    e.preventDefault();
    setQueuingComfy(true);
    setComfyResult(null);

    try {
      const res = await fetch('/api/comfyui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: comfyPrompt,
          aspectRatio: comfyAspectRatio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue generation');

      setComfyResult(`Job queued successfully! Prompt ID: ${data.promptId}`);
      setTimeout(() => {
        setIsComfyOpen(false);
        setComfyResult(null);
      }, 2500);
    } catch (err) {
      setComfyResult(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
    } finally {
      setQueuingComfy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Asset Library</h1>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
              Media &amp; Provenance Vault
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Media management with strict suitability classification, cryptographic provenance, and Safety Gate clearance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              checkComfy();
              setIsComfyOpen(true);
            }}
            className="h-10 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Bot className="w-4 h-4 text-indigo-600 dark:text-purple-400" />
            ComfyUI Studio
          </button>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Asset
          </button>
        </div>
      </div>

      {/* Filter & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs transition-colors">
        <div className="flex flex-wrap items-center gap-4">
          {/* Persona Filter (Strictly show assets for selected persona) */}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-600 dark:text-slate-400 font-semibold">Persona:</span>
            <select
              value={selectedPersonaId}
              onChange={(e) => {
                setSelectedPersonaId(e.target.value);
                setSelectedAssetIds(new Set());
              }}
              className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-lg px-2.5 text-slate-900 dark:text-white focus:border-indigo-500 cursor-pointer min-w-[150px]"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.adultAge ? `(Age ${p.adultAge})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Suitability:</span>
            <select
              value={suitabilityFilter}
              onChange={(e) => setSuitabilityFilter(e.target.value)}
              className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg px-2.5 text-slate-800 dark:text-slate-200 focus:border-indigo-500"
            >
              <option value="all">All Classes</option>
              <option value="sfw_safe">SFW Safe (Social Compliant)</option>
              <option value="adult_only">Adult Only (Monetization)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Safety Status:</span>
            <select
              value={safetyFilter}
              onChange={(e) => setSafetyFilter(e.target.value)}
              className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg px-2.5 text-slate-800 dark:text-slate-200 focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="passed">Passed (Queue Ready)</option>
              <option value="needs_manual_review">Needs Review</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          {assets.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {selectedAssetIds.size === assets.length && assets.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Select All
                </>
              )}
            </button>
          )}

          <span>Total: <strong className="text-slate-900 dark:text-white font-semibold">{total}</strong> assets</span>
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Refresh assets"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedAssetIds.size > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>
              {selectedAssetIds.size} asset{selectedAssetIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={() => setDeleteConfirmTarget('batch')}
              className="h-8 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedAssetIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Asset Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400 text-xs">
          <Sparkles className="w-5 h-5 animate-spin mr-2 text-indigo-600 dark:text-indigo-400" />
          Loading asset catalog...
        </div>
      ) : assets.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => {
            const tags: string[] = asset.tags ? JSON.parse(asset.tags) : [];

            return (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAsset(asset)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedAsset(asset);
                  }
                }}
                className={`group relative rounded-xl border bg-white dark:bg-slate-900/60 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                  selectedAssetIds.has(asset.id)
                    ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-sm'
                    : asset.safetyStatus === 'blocked'
                    ? 'border-rose-300 dark:border-rose-500/40 hover:border-rose-500'
                    : asset.safetyStatus === 'needs_manual_review'
                    ? 'border-amber-300 dark:border-amber-500/40 hover:border-amber-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                }`}
              >
                {/* Media Thumbnail */}
                <div className="aspect-square bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative">
                  {asset.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={asset.url}
                      alt="Asset"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-400 dark:text-slate-700" />
                  )}

                  {/* Select Checkbox (Top-Left) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectAsset(asset.id);
                    }}
                    className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                      selectedAssetIds.has(asset.id)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-900/70 hover:bg-slate-900 text-white/80 opacity-0 group-hover:opacity-100 backdrop-blur-xs'
                    }`}
                    title={selectedAssetIds.has(asset.id) ? 'Deselect asset' : 'Select asset'}
                  >
                    {selectedAssetIds.has(asset.id) ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Quick Delete Option (Top-Right) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmTarget(asset);
                    }}
                    className="absolute top-2 right-2 z-20 w-6 h-6 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all shadow-xs backdrop-blur-xs"
                    title="Delete asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Suitability & C2PA Badges (Bottom-Left) */}
                  <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1 z-10">
                    {asset.suitability === 'adult_only' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-900/90 text-purple-200 border border-purple-400/50 text-[9px] font-bold backdrop-blur-md">
                        <Lock className="w-2.5 h-2.5 text-purple-300" />
                        ADULT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/90 text-emerald-200 border border-emerald-400/40 text-[9px] font-bold backdrop-blur-md">
                        SFW
                      </span>
                    )}

                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-900/80 text-sky-300 text-[9px] font-mono border border-sky-400/20 backdrop-blur-md">
                      <FileCheck className="w-2.5 h-2.5" />
                      C2PA
                    </span>
                  </div>

                  {/* Safety Gate Status Badge (Bottom-Right) */}
                  <div className="absolute bottom-2 right-2 z-10">
                    {asset.safetyStatus === 'passed' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        PASSED
                      </span>
                    )}
                    {asset.safetyStatus === 'blocked' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold animate-pulse">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        BLOCKED
                      </span>
                    )}
                    {asset.safetyStatus === 'needs_manual_review' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        REVIEW
                      </span>
                    )}
                    {asset.safetyStatus === 'pending' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[9px] font-medium">
                        <Clock className="w-2.5 h-2.5" />
                        PENDING
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-2.5 space-y-1 text-slate-700 dark:text-slate-300 text-[11px]">
                  <div className="truncate font-medium text-slate-900 dark:text-slate-200">
                    {tags.length > 0 ? tags.join(', ') : 'Untitled Asset'}
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                    <span className="uppercase">{asset.type}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-white dark:bg-slate-900/40">
          <ImageIcon className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Assets Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Upload your first persona image or generate one using the ComfyUI Studio. All uploads pass through the Section 2 Safety Gate automatically.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Upload First Asset
          </button>
        </div>
      )}

      {/* UPLOAD ASSET MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Upload Asset to Persona Library
              </h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Drop Area */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50 dark:bg-slate-950/60 transition-all space-y-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  required
                  onChange={(e) => {
                    if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto" />
                {uploadFile ? (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Click to choose image or video
                    </div>
                    <div className="text-[11px] text-slate-500">
                      PNG, JPG, WEBP, MP4 (EXIF stripped &amp; C2PA provenance added automatically)
                    </div>
                  </div>
                )}
              </div>

              {/* Suitability Class Selector (Guardrail 4) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Asset Class Suitability <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Hard constraint</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadSuitability('sfw_safe')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      uploadSuitability === 'sfw_safe'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      SFW Safe
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Eligible for Instagram, X, Threads, and TikTok social queues.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadSuitability('adult_only')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      uploadSuitability === 'adult_only'
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-800 dark:text-purple-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      Adult Only (18+)
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Fanvue monetization only. Hard-blocked from social queues.
                    </p>
                  </button>
                </div>
              </div>

              {/* Tags & Prompt */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Tags / Scene Description</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                  placeholder="e.g. streetwear, digital art, studio, neon"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Prompt / Generation Notes</label>
                <textarea
                  rows={2}
                  value={uploadPrompt}
                  onChange={(e) => setUploadPrompt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                  placeholder="Generation prompt used to verify against negative keywords..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {uploading ? 'Processing & Scanning...' : 'Upload & Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT ASSET DETAIL MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Asset Inspector</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">({selectedAsset.id.slice(0, 8)})</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Media Preview */}
              <div className="aspect-square bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                {selectedAsset.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedAsset.url}
                    alt="Asset"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-slate-400 dark:text-slate-700" />
                )}
              </div>

              {/* Safety & Provenance Details */}
              <div className="space-y-4 text-xs">
                {/* Status Badges */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedAsset.suitability === 'adult_only'
                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                    }`}
                  >
                    {selectedAsset.suitability}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedAsset.safetyStatus === 'passed'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                        : selectedAsset.safetyStatus === 'blocked'
                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
                        : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                    }`}
                  >
                    Safety: {selectedAsset.safetyStatus}
                  </span>
                </div>

                {/* Safety Reasons */}
                <div className="space-y-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold block">Safety Gate Findings:</span>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    {selectedAsset.safetyReasons ? (
                      (JSON.parse(selectedAsset.safetyReasons) as string[]).map((r, i) => (
                        <p key={i} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                          <span>{r}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500">No safety report available.</p>
                    )}
                  </div>
                </div>

                {/* Cryptographic Provenance Manifest */}
                <div className="space-y-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold block">C2PA / Provenance Metadata:</span>
                  <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-sky-700 dark:text-sky-300 overflow-x-auto max-h-32">
                    {selectedAsset.provenanceMeta
                      ? JSON.stringify(JSON.parse(selectedAsset.provenanceMeta), null, 2)
                      : 'None'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(selectedAsset)}
                className="h-9 px-3.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Asset
              </button>

              <button
                onClick={() => setSelectedAsset(null)}
                className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMFYUI SFW GENERATION STUDIO MODAL */}
      {isComfyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">ComfyUI SFW Persona Studio</h2>
              </div>
              <button
                onClick={() => setIsComfyOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Server Status Pill */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    comfyStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-slate-700 dark:text-slate-300">{comfyStatus.message}</span>
              </div>
              <button
                onClick={checkComfy}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Check Again
              </button>
            </div>

            {comfyResult && (
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs">
                {comfyResult}
              </div>
            )}

            <form onSubmit={handleQueueComfy} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">Character Prompt (SFW Only)</label>
                <textarea
                  rows={3}
                  required
                  value={comfyPrompt}
                  onChange={(e) => setComfyPrompt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500"
                  placeholder="e.g. Aria Nova reviewing holographic architecture diagrams, soft rim lighting..."
                />
                <p className="text-[11px] text-slate-500">
                  Section 2 Guardrail: Negative triggers automatically injected against minors, celebrities, and explicit content.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-2 font-mono text-center">
                  {(['1:1', '4:5', '9:16', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setComfyAspectRatio(ratio)}
                      className={`h-9 rounded-lg border text-xs font-semibold ${
                        comfyAspectRatio === ratio
                          ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-500 text-indigo-700 dark:text-white'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComfyOpen(false)}
                  className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={queuingComfy}
                  className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {queuingComfy ? 'Queueing Job...' : 'Queue SFW Generation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {deleteConfirmTarget === 'batch'
                    ? `Delete ${selectedAssetIds.size} Selected Asset${selectedAssetIds.size > 1 ? 's' : ''}?`
                    : 'Delete Asset Permanently?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This will remove the media file from disk and database.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300">
              <strong>Notice:</strong> This action cannot be undone. Any linked variants or drafts referencing this asset will have their asset link unassigned.
            </div>

            <div className="flex justify-end items-center gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={executeDelete}
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {deleteConfirmTarget === 'batch'
                  ? `Delete ${selectedAssetIds.size} Asset${selectedAssetIds.size > 1 ? 's' : ''}`
                  : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
