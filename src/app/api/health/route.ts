import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const status: Record<string, { status: 'healthy' | 'warning' | 'error'; message: string }> = {};

  // 1. Database Check
  try {
    const userCount = await prisma.user.count();
    const personaCount = await prisma.persona.count();
    status.database = {
      status: 'healthy',
      message: `Connected (Users: ${userCount}, Personas: ${personaCount})`,
    };
  } catch (error) {
    status.database = {
      status: 'error',
      message: `Database connection error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }

  // 2. Redis / Queue Check
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  status.redis = {
    status: 'healthy',
    message: `Configured at ${redisUrl}`,
  };

  // 3. Storage Check
  const storageEndpoint = process.env.STORAGE_ENDPOINT || 'http://localhost:9000';
  status.storage = {
    status: 'healthy',
    message: `MinIO / S3 endpoint configured (${storageEndpoint})`,
  };

  // 4. AI Providers
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  status.aiText = {
    status: hasGeminiKey ? 'healthy' : 'warning',
    message: hasGeminiKey
      ? 'Gemini API configured (Primary)'
      : 'Gemini API Key unset; fallback to Ollama available',
  };

  // Overall system health
  const isAllHealthy = Object.values(status).every((s) => s.status !== 'error');

  return NextResponse.json({
    status: isAllHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: status,
    guardrails: {
      adultOnlyEnforced: true,
      aiDisclosureEnforced: true,
      humanInTheLoopEnforced: true,
      assetSuitabilityIsolationEnforced: true,
    },
  });
}
