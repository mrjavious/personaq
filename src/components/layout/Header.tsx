'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, Activity } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Command Center',
  '/persona': 'Persona Agent & Visual Studio',
  '/content-manager': 'Content Manager & Production',
  '/assets': 'Asset Library',
  '/safety-gate': 'Safety Gate & Clearance',
  '/scheduler': 'Composer & Calendar',
  '/publishing': 'Publishing Adapters',
  '/links': 'Link Hub & Funnels',
  '/analytics': 'Analytics Insights',
  '/engagement': 'Engagement Assistant',
  '/compliance': 'Compliance & Audit',
};

export default function Header() {
  const pathname = usePathname();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'degraded'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data.status === 'ok' ? 'healthy' : 'degraded');
      })
      .catch(() => setHealthStatus('degraded'));
  }, []);

  const currentLabel = ROUTE_LABELS[pathname] || 'Studio';

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 transition-colors">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="font-semibold tracking-tight text-slate-900 dark:text-white">Persona Studio</span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-slate-500 dark:text-slate-400 font-normal">{currentLabel}</span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Disclosure Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium text-[11px]">AI Disclosure: Required</span>
        </div>

        {/* System Health */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <Activity
            className={`w-3.5 h-3.5 ${
              healthStatus === 'healthy'
                ? 'text-emerald-500 dark:text-emerald-400'
                : healthStatus === 'checking'
                ? 'text-amber-500 dark:text-amber-400 animate-spin'
                : 'text-rose-500 dark:text-rose-400'
            }`}
          />
          <span className="text-slate-600 dark:text-slate-300 capitalize text-[11px] font-medium">
            {healthStatus === 'checking' ? 'Checking...' : healthStatus}
          </span>
        </div>

        {/* Dark & Light Mode Switch */}
        <ThemeToggle />
      </div>
    </header>
  );
}
