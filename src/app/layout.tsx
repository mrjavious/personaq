import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

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
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
