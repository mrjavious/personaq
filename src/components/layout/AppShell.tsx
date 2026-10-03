'use client';

import React, { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

const SIDEBAR_STORAGE_KEY = 'personaq-sidebar-collapsed';
const SIDEBAR_EVENT = 'personaq-sidebar-toggle';

function subscribeSidebar(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

function getSidebarSnapshot(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSidebarSnapshot(): boolean {
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthOrPublicPage = pathname?.startsWith('/login') || pathname?.startsWith('/l/');
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getServerSidebarSnapshot
  );

  const handleToggleSidebar = () => {
    try {
      const current = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!current));
      window.dispatchEvent(new Event(SIDEBAR_EVENT));
    } catch {
      // Ignore
    }
  };

  if (isAuthOrPublicPage) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Header />
          <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
