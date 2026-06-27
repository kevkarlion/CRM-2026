import type { CurrentUser, RequestLike } from './types';
import { getCurrentUser } from './request-context';
import { AuthenticationError } from './errors';

/**
 * Route handler that receives the authenticated user context.
 *
 * Returns a standard Response (compatible with NextResponse, Web API Response).
 */
export type AuthenticatedHandler<T = unknown> = (
  request: RequestLike,
  context: { params: Record<string, string | string[] | undefined>; user: CurrentUser },
) => Promise<Response & { json(): Promise<T> }>;

/**
 * Higher-order function that wraps a route handler with auth extraction.
 *
 * The wrapper extracts the authenticated user via `getCurrentUser()` before
 * calling the handler. If authentication fails, it returns a 401 JSON response
 * without executing the handler.
 *
 * @example
 * ```ts
 * import { withAuth } from '@/core/auth';
 * import { NextResponse } from 'next/server';
 *
 * export const GET = withAuth(async (request, { params, user }) => {
 *   const data = await service.findByTenant(user.tenantId);
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withAuth<T>(handler: AuthenticatedHandler<T>) {
  return async (
    request: RequestLike,
    { params }: { params: Record<string, string | string[] | undefined> },
  ) => {
    try {
      const user = await getCurrentUser(request);
      return handler(request, { params, user });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.statusCode,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw error;
    }
  };
}
