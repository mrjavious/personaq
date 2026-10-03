import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, requireAuth, requirePermission } from '@/lib/auth/guards';
import { getCurrentUser, type SessionPayload } from '@/lib/auth/session';
import type { Permission } from '@/lib/auth/rbac';

export interface ApiHandlerContext<TParams = Record<string, string | string[]>> {
  params?: Promise<TParams> | TParams;
  user: SessionPayload;
}

export interface WithApiOptions {
  permission?: Permission;
  public?: boolean;
}

export type ApiHandler<TParams = Record<string, string | string[]>> = (
  request: Request,
  context: ApiHandlerContext<TParams>,
) => Promise<NextResponse | Response>;

export function withApi<TParams = Record<string, string | string[]>>(
  handler: ApiHandler<TParams>,
  options: WithApiOptions = {},
) {
  return async (
    request: Request,
    context?: { params?: Promise<TParams> | TParams },
  ): Promise<NextResponse | Response> => {
    try {
      let user: SessionPayload | null = null;

      if (options.permission) {
        user = await requirePermission(options.permission);
      } else if (!options.public) {
        user = await requireAuth();
      } else {
        user = await getCurrentUser();
      }

      const handlerContext: ApiHandlerContext<TParams> = {
        params: context?.params,
        user: user as SessionPayload,
      };

      return await handler(request, handlerContext);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, success: false },
          { status: error.statusCode },
        );
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Invalid input', details: error.flatten(), success: false },
          { status: 400 },
        );
      }

      console.error('Unhandled API Error:', error);
      return NextResponse.json(
        { error: 'Internal server error', success: false },
        { status: 500 },
      );
    }
  };
}
