import type { RequestLike } from '../core/auth/types';
import type { ErrorContext, RequestEnrichment } from './types';

/**
 * Create a request enrichment context from the incoming HTTP request.
 *
 * Generates a unique `requestId` via `crypto.randomUUID()` and captures
 * the request timestamp. The returned `enrich()` helper can build a
 * complete ErrorContext for any error that occurs during the request.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const ctx = createRequestContext(request);
 *
 *   try {
 *     const data = await service.list();
 *     return NextResponse.json(data);
 *   } catch (error) {
 *     const errCtx = ctx.enrich({ action: 'lead.list' });
 *     return handleRouteError(error, errCtx);
 *   }
 * }
 * ```
 */
export function createRequestContext(request: RequestLike): RequestEnrichment {
  const requestId = crypto.randomUUID();
  const timestamp = new Date();

  return {
    requestId,
    timestamp,
    enrich(partial: Partial<ErrorContext>): ErrorContext {
      return {
        action: partial.action || 'unknown',
        userId: partial.userId,
        tenantId: partial.tenantId,
        requestId,
        timestamp,
      };
    },
  };
}
