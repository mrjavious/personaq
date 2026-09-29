'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Activity } from 'lucide-react';

export default function Header() {
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'degraded'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data.status === 'ok' ? 'healthy' : 'degraded');
      })
      .catch(() => setHealthStatus('degraded'));
  }, []);

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span>Persona Studio</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-normal">Command Center</span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Disclosure Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-medium">AI Disclosure: Required</span>
        </div>

        {/* System Health */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Activity
            className={`w-3.5 h-3.5 ${
              healthStatus === 'healthy'
                ? 'text-emerald-400'
                : healthStatus === 'checking'
                ? 'text-amber-400 animate-spin'
                : 'text-rose-400'
            }`}
          />
          <span className="text-slate-300 capitalize">
            {healthStatus === 'checking' ? 'Checking...' : healthStatus}
          </span>
        </div>
      </div>
    </header>
  );
}
