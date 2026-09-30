import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: 'Persona Studio (personaq) | AI Persona Management & Guardrails',
  description:
    'Manage disclosed, fictional AI personas with strict safety checks, multi-platform scheduling, and compliance guardrails.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('personaq-theme');
                  var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) || !stored;
                  if (stored === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.style.colorScheme = 'dark';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-indigo-500/20 selection:text-indigo-600 dark:selection:bg-indigo-500/30 dark:selection:text-indigo-200">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
