'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'totp' | 'setup_2fa'>('credentials');
  const [email, setEmail] = useState('creator@personaq.local');
  const [password, setPassword] = useState('password123');
  const [totpToken, setTotpToken] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Setup 2FA State
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
    backupCodes: string[];
  } | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      if (data.require2FA) {
        setStep('totp');
      } else if (data.requireSetup2FA) {
        const setupRes = await fetch('/api/auth/setup-2fa');
        const setupJson = await setupRes.json();
        if (!setupRes.ok) throw new Error(setupJson.error || 'Failed to load 2FA setup');
        setSetupData(setupJson);
        setStep('setup_2fa');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpToken, isBackupCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: totpToken,
          secret: setupData.secret,
          backupCodes: setupData.backupCodes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify 2FA token');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex w-10 h-10 rounded-xl bg-slate-900 dark:bg-white items-center justify-center text-white dark:text-slate-900 font-bold text-base shadow-sm">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Persona Studio</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {step === 'credentials' && 'Owner / Operator Sign In'}
              {step === 'totp' && 'Two-Factor Authentication Required'}
              {step === 'setup_2fa' && '2FA Mandatory Enrollment'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Credentials */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="creator@personaq.local"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Dev Default:</span> creator@personaq.local / password123
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Step 2: 2FA Verification */}
        {step === 'totp' && (
          <form onSubmit={handleTotpVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {isBackupCode ? 'Single-Use Backup Code' : '6-Digit Authenticator Code'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder={isBackupCode ? 'XXXX-XXXX' : '123456'}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsBackupCode(!isBackupCode)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isBackupCode ? 'Use 6-digit Authenticator App' : 'Use a backup code instead'}
              </button>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {/* Step 3: Mandatory 2FA Enrollment */}
        {step === 'setup_2fa' && setupData && (
          <form onSubmit={handleSetupComplete} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Scan this QR code with Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
            </p>

            <div className="flex justify-center p-3 bg-white rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setupData.qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Secret Key (Manual Entry)</label>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] select-all break-all border border-slate-200 dark:border-slate-800">
                {setupData.secret}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Enter Verification Code</label>
              <input
                type="text"
                required
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value)}
                className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Activating 2FA...' : 'Confirm & Activate 2FA'}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            Section 2 Guardrails Enforced (2FA Mandatory)
          </div>
        </div>
      </div>
    </div>
  );
}
