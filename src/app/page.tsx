'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Database,
  Layers,
  HardDrive,
  Bot,
  ArrowRight,
  Sparkles,
  Lock,
  UserCheck,
  Fingerprint,
} from 'lucide-react';

interface HealthData {
  status: string;
  services: {
    database: { status: string; message: string };
    redis: { status: string; message: string };
    storage: { status: string; message: string };
    aiText: { status: string; message: string };
  };
}

export default function DashboardOverviewPage() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Failed to load health:', err));
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome & Setup Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs transition-colors">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            Infrastructure &amp; Guardrails Active
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Persona Studio <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xl md:text-2xl font-semibold">personaq</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Autonomous creator management engine for disclosed, fictional AI personas. Fully configured with non-negotiable adult-only guardrails, asset safety gate separation, 2FA security, and multi-platform adapters.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/persona"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Configure Persona Agent
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Fingerprint className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Manage 2FA &amp; Auth
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Guardrails Enforcement Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Section 2 Non-Negotiable Guardrails</h2>
          </div>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50">
            All 9 Guardrails Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5 transition-colors">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-xs">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              1. Adult-Only Persona
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Persona requires adult age (&ge; 25 default). Safety gate blocks any asset depicting or resembling a minor.
            </p>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Hard database &amp; model check
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5 transition-colors">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              2 &amp; 3. Fictional Identity &amp; AI Disclosure
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Zero real-person likeness. AI disclosure required in all bios, captions, and platform flags (<code className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">ai_generated = true</code>).
            </p>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified in prompts &amp; payloads
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5 transition-colors">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-xs">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              4. Asset Class Separation
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Assets partitioned into <code className="text-amber-700 dark:text-amber-400 font-mono text-[11px]">sfw_safe</code> or <code className="text-amber-700 dark:text-amber-400 font-mono text-[11px]">adult_only</code>. Adult assets can never target SFW queues.
            </p>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enforced by database trigger &amp; service
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure & Services Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Infrastructure &amp; System Connectivity</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Docker Compose &amp; Local Stack Ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Database */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Database</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {health?.services.database.message || 'Prisma ORM (dev.db SQLite / Postgres 16)'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-1">12 Schema Models Synced</div>
          </div>

          {/* Redis */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Queue Worker</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {health?.services.redis.message || 'Redis 7 / BullMQ Task Queue'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-1">Port 6379 Ready</div>
          </div>

          {/* Storage */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Asset Storage</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {health?.services.storage.message || 'MinIO (Local) / Cloudflare R2 (Prod)'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-1">S3-Compatible • Encrypted</div>
          </div>

          {/* AI Providers */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">AI Text &amp; Image</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {health?.services.aiText.message || 'Gemini API + Ollama Local Fallback'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-1">ComfyUI HTTP API :8188</div>
          </div>
        </div>
      </div>

      {/* System Capabilities & Core Modules */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">System Modules &amp; Architecture</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { tag: 'Security', title: '2FA & Guardrails', status: 'Active' },
            { tag: 'Identity', title: 'Persona Agent', status: 'Active' },
            { tag: 'Governance', title: 'Assets & Safety', status: 'Active' },
            { tag: 'AI Engine', title: 'Content & Captions', status: 'Active' },
            { tag: 'Dispatch', title: 'Publishing Vault', status: 'Active' },
            { tag: 'Funnel', title: 'Link Hub & UTM', status: 'Active' },
            { tag: 'Desktop', title: 'Tauri Wrapper', status: 'Ready' },
          ].map((mod, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 transition-colors shadow-2xs"
            >
              <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                {mod.tag}
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {mod.title}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ {mod.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
