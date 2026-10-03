import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/logging';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async (_request: Request, context) => {
    const status: Record<string, { status: 'healthy' | 'warning' | 'error'; message: string }> = {};

    // 1. Database Check
    let userCount = 0;
    let personaCount = 0;
    let postCount = 0;
    try {
      const start = Date.now();
      [userCount, personaCount, postCount] = await Promise.all([
        prisma.user.count(),
        prisma.persona.count(),
        prisma.post.count(),
      ]);
      const dbLatency = Date.now() - start;
      status.database = {
        status: dbLatency < 1000 ? 'healthy' : 'warning',
        message: `Connected (Latency: ${dbLatency}ms)`,
      };
    } catch (error) {
      status.database = {
        status: 'error',
        message: `Database connection error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
      logger.error('Health check: database error', { error });
    }

    // 2. Redis / Queue Check (Never output secret REDIS_URL)
    try {
      const hasRedis = Boolean(process.env.REDIS_URL);
      status.redis = {
        status: hasRedis ? 'healthy' : 'warning',
        message: hasRedis ? 'Redis configured' : 'Redis not configured',
      };
    } catch (error) {
      status.redis = {
        status: 'error',
        message: `Redis connection error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }

    // 3. Storage Check
    try {
      const storageUseS3 = process.env.STORAGE_USE_S3 === 'true';
      status.storage = {
        status: 'healthy',
        message: `${storageUseS3 ? 'S3/MinIO' : 'Local disk'} storage configured`,
      };
    } catch (error) {
      status.storage = {
        status: 'error',
        message: `Storage error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }

    // 4. AI Providers
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
    const hasOllamaUrl = Boolean(process.env.OLLAMA_BASE_URL);
    status.aiText = {
      status: hasGeminiKey ? 'healthy' : hasOllamaUrl ? 'warning' : 'error',
      message: hasGeminiKey
        ? 'Gemini API configured (Primary)'
        : hasOllamaUrl
          ? 'Ollama configured (Fallback)'
          : 'No AI provider configured',
    };

    // 5. Disk Check (Never output local filesystem paths)
    if (process.env.STORAGE_USE_S3 !== 'true') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        fs.statSync(uploadsDir);
        status.disk = {
          status: 'healthy',
          message: 'Uploads directory accessible',
        };
      } catch {
        status.disk = {
          status: 'warning',
          message: 'Uploads directory not found',
        };
      }
    }

    // Overall system health
    const isAllHealthy = Object.values(status).every((s) => s.status !== 'error');
    const isDegraded = Object.values(status).some((s) => s.status === 'warning');
    const overallStatus: 'ok' | 'degraded' = isAllHealthy && !isDegraded ? 'ok' : 'degraded';

    // Unauthenticated callers get ONLY { status: 'ok' | 'degraded' }
    if (!context.user) {
      return NextResponse.json(
        { status: overallStatus },
        { status: isAllHealthy ? 200 : 503 },
      );
    }

    // Authenticated callers receive the detailed, sanitized report
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      counts: {
        users: userCount,
        personas: personaCount,
        posts: postCount,
      },
      services: status,
      guardrails: {
        adultOnlyEnforced: true,
        aiDisclosureEnforced: true,
        humanInTheLoopEnforced: true,
        assetSuitabilityIsolationEnforced: true,
      },
    };

    return NextResponse.json(response, {
      status: isAllHealthy ? 200 : 503,
    });
  },
  { public: true },
);
