'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Film,
  LogOut,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronDown,
  Check,
  Users,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/persona', label: 'Persona Agent', icon: BookOpen },
  { href: '/content-manager', label: 'Content Manager', icon: Film },
  { href: '/assets', label: 'Asset Library', icon: ImageIcon },
  { href: '/safety-gate', label: 'Safety Gate', icon: ShieldAlert },
  { href: '/scheduler', label: 'Composer & Calendar', icon: CalendarDays },
  { href: '/publishing', label: 'Publishing Adapters', icon: Send },
  { href: '/links', label: 'Link Hub & Funnel', icon: Link2 },
  { href: '/analytics', label: 'Analytics Insights', icon: BarChart3 },
  { href: '/engagement', label: 'Engagement Assistant', icon: MessageSquareQuote },
  { href: '/compliance', label: 'Compliance & Audit', icon: ClipboardCheck },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [activePersona, setActivePersona] = useState<{ id: string; name: string; adultAge: number; avatarUrl?: string | null; backstory?: string } | null>(null);
  const [allPersonas, setAllPersonas] = useState<{ id: string; name: string; adultAge: number; avatarUrl?: string | null }[]>([]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/persona')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.allPersonas && Array.isArray(data.allPersonas)) {
          setAllPersonas(data.allPersonas);
        }
        if (data.persona) {
          setActivePersona(data.persona);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside
      className={`${
        collapsed ? 'w-18' : 'w-64'
      } bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl transition-all duration-300 z-30`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand & Collapse Toggle */}
        <div className={`p-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" className="flex items-center gap-2.5 group overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform shrink-0">
              P
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs tracking-tight flex items-center gap-1.5">
                  Persona Studio
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50 font-mono font-medium">
                    v0.1
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Autonomous AI Creator</div>
              </div>
            )}
          </Link>

          {!collapsed && onToggle && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed Toggle Button when collapsed */}
        {collapsed && onToggle && (
          <div className="p-2 flex justify-center border-b border-slate-200 dark:border-slate-800/80">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Persona Indicator & Quick Switcher */}
        {!collapsed ? (
          <div ref={dropdownRef} className="relative mx-3 my-3">
            <button
              type="button"
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800/80 transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Active Persona
                </span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40 font-medium">
                  Age {activePersona?.adultAge || 21} • Adult
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-purple-400 shrink-0" />
                  <span className="truncate">{activePersona?.name || 'Aria Nova'}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                {allPersonas.length > 1 ? `${allPersonas.length} personas registered • Click to switch` : 'Click to manage persona'}
              </p>
            </button>

            {/* Persona Switcher Dropdown */}
            {isSwitcherOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2 z-50 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 flex items-center justify-between">
                  <span>Switch Persona</span>
                  <span>{allPersonas.length} total</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {allPersonas.map((p) => {
                    const isSelected = (activePersona?.id === p.id) || (allPersonas.length === 1);
                    return (
                      <Link
                        key={p.id}
                        href={`/persona?id=${p.id}`}
                        onClick={() => {
                          setActivePersona(p);
                          setIsSwitcherOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <div className="truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">Age {p.adultAge}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href="/persona?new=true"
                    onClick={() => setIsSwitcherOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create New Persona
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/persona"
            className="my-2 flex justify-center"
            title={`Active Persona: ${activePersona?.name || 'Aria Nova'} (Age ${activePersona?.adultAge || 21}) - Click to switch or create`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
          </Link>
        )}

        {/* Nav Links */}
        <nav className="px-2 space-y-1 overflow-y-auto flex-1 py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center ${
                  collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User / 2FA Status Footer */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
        {!collapsed ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-indigo-500/20 shrink-0">
                <Fingerprint className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden min-w-0">
                <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                  creator@personaq.local
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  2FA Active
                </div>
              </div>
            </div>
            <Link
              href="/login"
              title="Switch Session or Manage 2FA"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1" title="creator@personaq.local • 2FA Active">
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-indigo-500/20">
              <Fingerprint className="w-3.5 h-3.5" />
            </div>
            <Link
              href="/login"
              title="Log Out"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
