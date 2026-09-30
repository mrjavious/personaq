'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  variant?: 'button' | 'segmented';
  className?: string;
}

export function ThemeToggle({ variant = 'button', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            theme === 'light'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="Light mode"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            theme === 'dark'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="Dark mode"
        >
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            theme === 'system'
              ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="System preference"
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
