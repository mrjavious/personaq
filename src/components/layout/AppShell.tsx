'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthOrPublicPage = pathname?.startsWith('/login') || pathname?.startsWith('/l/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem('personaq-sidebar-collapsed');
        if (stored !== null) {
          setSidebarCollapsed(stored === 'true');
        }
      } catch {
        // Ignore localStorage errors
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('personaq-sidebar-collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
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
