'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Sparkles, Lock, AlertTriangle } from 'lucide-react';

export default function GuardrailsBanner() {
  return (
    <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-md px-4 py-2 text-xs text-slate-600 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold tracking-wide text-[11px] uppercase">
            <ShieldCheck className="w-3.5 h-3.5" /> Section 2 Guardrails Enforced:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-medium">
            <UserCheck className="w-3 h-3 text-emerald-500" />
            Adult-Only (&ge; 25)
          </span>

          <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800/80 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-medium">
            <Sparkles className="w-3 h-3 text-sky-500" />
            Disclosed AI Identity
          </span>

          <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800/80 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-medium">
            <Lock className="w-3 h-3 text-amber-500" />
            SFW / Adult Separation
          </span>

          <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-medium">
            <AlertTriangle className="w-3 h-3 text-indigo-500" />
            Human-in-the-Loop
          </span>
        </div>
      </div>
    </div>
  );
}
