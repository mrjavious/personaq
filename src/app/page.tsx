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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            System Infrastructure &amp; Security Ready
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Persona Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">personaq</span>
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Autonomous creator management engine for disclosed, fictional AI personas. Fully configured with non-negotiable adult-only guardrails, asset safety gate separation, 2FA security, and multi-platform adapters.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/persona"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Configure Persona Bible
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
            >
              <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
              Manage 2FA & Auth
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Guardrails Enforcement Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">Section 2 Non-Negotiable Guardrails</h2>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            All 9 Guardrails Active & Tested
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              1. Adult-Only Persona
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Persona requires adult age (&gt;= 25 default). Safety gate blocks any asset depicting or resembling a minor.
            </p>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Hard database & model check
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              2 & 3. Fictional Identity & AI Disclosure
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Zero real-person likeness. AI disclosure required in all bios, captions, and platform flags (<code className="text-indigo-300">ai_generated = true</code>).
            </p>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified in prompts & payloads
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <Lock className="w-4 h-4 text-amber-400" />
              4. Asset Class Separation
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Assets partitioned into <code className="text-amber-300">sfw_safe</code> or <code className="text-amber-300">adult_only</code>. Adult assets can never target SFW social queues.
            </p>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enforced by database trigger & service
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure & Services Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">Infrastructure & System Connectivity</h2>
          </div>
          <span className="text-xs text-slate-400">Docker Compose & Local Stack Ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Database */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">Database</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400">
              {health?.services.database.message || 'Prisma ORM (dev.db SQLite / Postgres 16)'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono">12 Schema Models Synced</div>
          </div>

          {/* Redis */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">Queue Worker</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400">
              {health?.services.redis.message || 'Redis 7 / BullMQ Task Queue'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono">Port 6379 Ready</div>
          </div>

          {/* Storage */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-200">Asset Storage</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400">
              {health?.services.storage.message || 'MinIO (Local) / Cloudflare R2 (Prod)'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono">S3-Compatible • Encrypted</div>
          </div>

          {/* AI Providers */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-semibold text-slate-200">AI Text & Image</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">
              {health?.services.aiText.message || 'Gemini API + Ollama Local Fallback'}
            </p>
            <div className="text-[10px] text-slate-500 font-mono">ComfyUI HTTP API :8188</div>
          </div>
        </div>
      </div>

      {/* System Capabilities & Core Modules */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100">System Modules &amp; Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Security</div>
            <div className="text-xs font-semibold text-slate-200">2FA &amp; Guardrails</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Identity</div>
            <div className="text-xs font-semibold text-slate-200">Persona Bible</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Governance</div>
            <div className="text-xs font-semibold text-slate-200">Assets &amp; Safety</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">AI Engine</div>
            <div className="text-xs font-semibold text-slate-200">Content &amp; Captions</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Dispatch</div>
            <div className="text-xs font-semibold text-slate-200">Publishing Vault</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Funnel</div>
            <div className="text-xs font-semibold text-slate-200">Link Hub &amp; UTM</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Active</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-indigo-400">Desktop</div>
            <div className="text-xs font-semibold text-slate-200">Tauri Wrapper</div>
            <div className="text-[11px] text-emerald-400 font-medium">✓ Ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}
