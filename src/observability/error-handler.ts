import type { ErrorContext } from './types';
import { logEventWithContext } from './system-logger';

/**
 * Default mapping of known error types to HTTP status codes.
 *
 * Route handlers can extend or override this by passing their own
 * `knownErrors` array to `handleRouteError()`.
 */
export const DefaultKnownErrors: Array<{
  type: new (...args: unknown[]) => Error;
  status: number;
}> = [
  // Validation errors → 400 Bad Request
  // { type: ValidationError, status: 400 },
  // Not found → 404
  // { type: NotFoundError, status: 404 },
  // Authentication → 401
  // { type: AuthenticationError, status: 401 },
  // Conflict → 409
  // { type: ConflictError, status: 409 },
];

/**
 * Unified error handler for route handlers.
 *
 * Logs the error with full structured context and returns an appropriate
 * HTTP response based on the error type. Unknown errors return 500.
 *
 * @param error - The caught error
 * @param context - Structured error context with action, user, tenant, requestId
 * @param knownErrors - Optional mapping of error types to HTTP status codes
 * @returns A Response object (compatible with NextResponse)
 *
 * @example
 * ```ts
 * try {
 *   const data = await service.list();
 *   return NextResponse.json(data);
 * } catch (error) {
 *   return handleRouteError(error, errCtx);
 * }
 * ```
 */
export function handleRouteError(
  error: unknown,
  context: ErrorContext,
  knownErrors: Array<{ type: new (...args: unknown[]) => Error; status: number }> = DefaultKnownErrors,
): Response {
  const message = error instanceof Error ? error.message : 'Internal server error';

  // Log the error with full context
  logEventWithContext('error', 'route-handler', message, context, {
    errorName: error instanceof Error ? error.name : 'Unknown',
    stack: error instanceof Error ? error.stack : undefined,
  }).catch(() => {
    // Fail silently — logging failure should not crash the handler
  });

  // Check known error types for appropriate status code
  for (const known of knownErrors) {
    if (error instanceof known.type) {
      return new Response(JSON.stringify({ error: message }), {
        status: known.status,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // Fallback: 500 Internal Server Error
  return new Response(JSON.stringify({ error: 'Internal server error' }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}
