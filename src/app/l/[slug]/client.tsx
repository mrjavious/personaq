'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Camera,
  Share2,
  AtSign,
  Video,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';

interface PublicLandingProps {
  linkId: string;
  slug: string;
  destinationUrl: string;
  persona: {
    name: string;
    backstory: string;
    voiceTone: string;
    aiDisclosureText: string;
    platforms: Array<{ platform: string; handle: string }>;
  };
}

export function PublicLandingClient({
  linkId,
  slug,
  destinationUrl,
  persona,
}: PublicLandingProps) {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get('utm_source') || 'direct_landing';
  const utmCampaign = searchParams.get('utm_campaign') || undefined;
  const utmContent = searchParams.get('utm_content') || undefined;

  const [clickedDest, setClickedDest] = useState<string | null>(null);

  const handleOutboundClick = async (targetUrl: string, sourceTag: string) => {
    setClickedDest(targetUrl);

    try {
      // Beacon / Privacy-respecting click logging
      await fetch('/api/links/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          slug,
          utmSource: sourceTag || utmSource,
          utmCampaign,
          utmContent,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
        }),
      });
    } catch (err) {
      console.error('Failed to log click:', err);
    } finally {
      // Proceed to outbound destination
      window.location.href = targetUrl;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Camera className="w-4 h-4 text-pink-400" />;
      case 'x':
        return <Share2 className="w-4 h-4 text-sky-400" />;
      case 'threads':
        return <AtSign className="w-4 h-4 text-indigo-400" />;
      case 'tiktok':
        return <Video className="w-4 h-4 text-cyan-400" />;
      case 'fanvue':
        return <HeartHandshake className="w-4 h-4 text-amber-400" />;
      default:
        return <ExternalLink className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPlatformUrl = (platform: string, handle: string) => {
    const cleanHandle = handle.replace(/^@/, '');
    switch (platform) {
      case 'instagram':
        return `https://instagram.com/${cleanHandle}`;
      case 'x':
        return `https://x.com/${cleanHandle}`;
      case 'threads':
        return `https://threads.net/@${cleanHandle}`;
      case 'tiktok':
        return `https://tiktok.com/@${cleanHandle}`;
      case 'fanvue':
        return `https://fanvue.com/${cleanHandle}`;
      default:
        return '#';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full mx-auto relative z-10 space-y-6">
        {/* Profile Card Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-xl shadow-indigo-500/20 mx-auto">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                {persona.name.charAt(0)}
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-indigo-500 text-white p-1 rounded-full shadow border-2 border-slate-950">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-xl font-extrabold text-white tracking-tight">{persona.name}</h1>
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xs text-indigo-300/80 font-mono mt-0.5">@{slug}.ai</p>
          </div>

          {/* AI Disclosure Banner (Section 2 Guardrail 3 Requirement) */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-[11px] text-indigo-200">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-medium">Disclosed Fictional AI Persona</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed px-4">
            {persona.backstory.slice(0, 160)}...
          </p>
        </div>

        {/* Action Links */}
        <div className="space-y-3 pt-2">
          {/* Primary Creator / Monetization Button (Fanvue / Destination) */}
          <button
            onClick={() => handleOutboundClick(destinationUrl, 'hub_primary_monetization')}
            disabled={clickedDest === destinationUrl}
            className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-[1.5px] transition-all hover:scale-[1.02] active:scale-[0.99] shadow-lg shadow-indigo-600/20"
          >
            <div className="flex items-center justify-between bg-slate-950/90 group-hover:bg-slate-900/80 px-5 py-4 rounded-[14px] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5 text-indigo-300" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    Exclusive Works &amp; Gallery
                    <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded font-mono">
                      VIP
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Direct creator tier on Fanvue
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </div>
          </button>

          {/* Social Platform Outbound Buttons */}
          <div className="space-y-2 pt-2">
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Official SFW Social Channels
            </div>

            {persona.platforms
              .filter((p) => p.platform !== 'fanvue')
              .map((account) => {
                const url = getPlatformUrl(account.platform, account.handle);
                return (
                  <button
                    key={account.platform}
                    onClick={() => handleOutboundClick(url, `social_${account.platform}`)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all text-xs text-slate-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                        {getPlatformIcon(account.platform)}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white capitalize">
                          {account.platform}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {account.handle}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors" />
                  </button>
                );
              })}
          </div>
        </div>

        {/* Footer Transparency Notice */}
        <div className="text-center pt-8 space-y-2 border-t border-slate-900">
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            {persona.aiDisclosureText}
          </p>
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <span>Powered by</span>
            <span className="font-semibold text-slate-300">Persona Studio (personaq)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
