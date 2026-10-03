import type { NextConfig } from "next";

function getStorageOrigin(): string {
  const url = process.env.STORAGE_PUBLIC_URL || process.env.STORAGE_ENDPOINT;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

const storageOrigin = getStorageOrigin();
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storageOrigin}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${storageOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: cspHeader },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '0' },
];

const isStandalone = process.env.OUTPUT_STANDALONE === 'true' || process.env.DOCKER_BUILD === '1';

const nextConfig: NextConfig = {
  ...(isStandalone ? { output: 'standalone' } : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};


export default nextConfig;
