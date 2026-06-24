import type { CurrentUser, CurrentTenant, RequestLike } from './types';
import { getAuthProvider } from './provider';

/**
 * Extract the authenticated user from the incoming request.
 *
 * Delegates to the active AuthProvider. By default reads
 * `x-user-id` and `x-tenant-id` headers.
 *
 * @throws {AuthenticationError} When headers are missing or invalid.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const user = await getCurrentUser(request);
 *   const data = await service.list(user.tenantId);
 *   return NextResponse.json(data);
 * }
 * ```
 */
export async function getCurrentUser(request: RequestLike): Promise<CurrentUser> {
  return getAuthProvider().extractUser(request);
}

/**
 * Extract the active tenant from the incoming request.
 *
 * Use this when only the tenant identity is needed
 * (e.g., listing public resources scoped to a tenant).
 *
 * @throws {AuthenticationError} When the tenant header is missing.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const { tenantId } = await getCurrentTenant(request);
 *   const data = await service.findByTenant(tenantId);
 *   return NextResponse.json(data);
 * }
 * ```
 */
export async function getCurrentTenant(request: RequestLike): Promise<CurrentTenant> {
  return getAuthProvider().extractTenant(request);
}
