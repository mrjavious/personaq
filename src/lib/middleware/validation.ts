import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

type ValidationSchema = z.ZodSchema;

interface ValidationConfig {
  body?: ValidationSchema;
  query?: ValidationSchema;
}

export function validateRequest(config: ValidationConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      // Validate query parameters
      if (config.query) {
        const query = Object.fromEntries(request.nextUrl.searchParams);
        const result = config.query.safeParse(query);
        if (!result.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: result.error.flatten() },
            { status: 400 },
          );
        }
      }

      // Validate body (for POST/PUT/PATCH)
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const body = await request.json();
          const result = config.body.safeParse(body);
          if (!result.success) {
            return NextResponse.json(
              { error: 'Invalid request body', details: result.error.flatten() },
              { status: 400 },
            );
          }
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 },
          );
        }
      }

      return null; // Validation passed
    } catch {
      return NextResponse.json(
        { error: 'Validation error' },
        { status: 500 },
      );
    }
  };
}

// Common validation schemas
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});
