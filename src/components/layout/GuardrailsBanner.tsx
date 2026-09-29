'use client';

import React from 'react';
import { ShieldCheck, UserCheck, AlertTriangle, Sparkles, Lock } from 'lucide-react';

export default function GuardrailsBanner() {
  return (
    <div className="bg-slate-900/90 border-b border-indigo-900/40 backdrop-blur-md px-4 py-2.5 text-xs text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-slate-100">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="flex items-center gap-1.5 text-indigo-300 font-semibold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Section 2 Non-Negotiable Guardrails Active:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 bg-slate-800/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
            <UserCheck className="w-3 h-3 text-emerald-400" />
            Adult-Only Persona (Age &gt;= 25)
          </span>

          <span className="flex items-center gap-1 bg-slate-800/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            AI Disclosed Everywhere
          </span>

          <span className="flex items-center gap-1 bg-slate-800/80 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
            <Lock className="w-3 h-3 text-amber-400" />
            SFW / Adult Separation Hard-Locked
          </span>

          <span className="flex items-center gap-1 bg-slate-800/80 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
            <AlertTriangle className="w-3 h-3 text-purple-400" />
            Human-in-the-Loop Required
          </span>
        </div>
      </div>
    </div>
  );
}
