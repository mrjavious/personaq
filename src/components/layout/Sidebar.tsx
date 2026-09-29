'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Image as ImageIcon,
  ShieldAlert,
  CalendarDays,
  Send,
  Link2,
  BarChart3,
  MessageSquareQuote,
  ClipboardCheck,
  Sparkles,
  LogOut,
  Fingerprint,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, phase: 'Phase 0' },
  { href: '/persona', label: 'Persona Bible', icon: BookOpen, phase: 'Phase 1' },
  { href: '/assets', label: 'Asset Library', icon: ImageIcon, phase: 'Phase 2' },
  { href: '/safety-gate', label: 'Safety Gate', icon: ShieldAlert, phase: 'Phase 2' },
  { href: '/scheduler', label: 'Composer & Calendar', icon: CalendarDays, phase: 'Phase 3' },
  { href: '/publishing', label: 'Publishing Adapters', icon: Send, phase: 'Phase 4' },
  { href: '/links', label: 'Link Hub & Funnel', icon: Link2, phase: 'Phase 5' },
  { href: '/analytics', label: 'Analytics Insights', icon: BarChart3, phase: 'Phase 5' },
  { href: '/engagement', label: 'Engagement Assistant', icon: MessageSquareQuote, phase: 'Phase 6' },
  { href: '/compliance', label: 'Compliance & Audit', icon: ClipboardCheck, phase: 'Phase 5' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-950/80 border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl">
      <div>
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
              P
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
                Persona Studio
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                  personaq
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Disclosed AI Management</div>
            </div>
          </div>
        </div>

        {/* Active Persona Pill */}
        <div className="mx-3 my-3 p-2.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400">
              Active Persona
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30 font-medium">
              Age 26 • Adult
            </span>
          </div>
          <div className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Aria Nova
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            ✨ Disclosed AI Creator • Neo-Arcadia
          </p>
        </div>

        {/* Nav Links */}
        <nav className="px-3 space-y-1 mt-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                <span className="text-[9px] text-slate-600 font-mono">{item.phase}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User / 2FA Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Fingerprint className="w-3.5 h-3.5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-[11px] font-semibold text-slate-200 truncate">
                creator@personaq.local
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Owner • 2FA Enforced
              </div>
            </div>
          </div>
          <Link
            href="/login"
            title="Switch Session or Manage 2FA"
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
