import type { AuthProvider, CurrentUser, CurrentTenant, RequestLike } from './types';
import { AuthenticationError } from './errors';

// ── Default provider: header-based ─────────────────────────

/**
 * Header-based auth provider.
 *
 * Reads authentication context from HTTP headers.
 * This is the development/default provider — it reads:
 * - `x-user-id` for the authenticated user
 * - `x-tenant-id` for the active tenant
 *
 * Permissions and roles are not available from headers alone,
 * so they return as empty arrays. Real auth (JWT/session) will
 * populate them from the token or database.
 */
export class HeaderAuthProvider implements AuthProvider {
  async extractUser(request: RequestLike): Promise<CurrentUser> {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      throw new AuthenticationError(
        'Missing authentication headers: x-user-id and x-tenant-id are required',
      );
    }

    return {
      userId,
      tenantId,
      roles: [],
      permissions: [],
    };
  }

  async extractTenant(request: RequestLike): Promise<CurrentTenant> {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      throw new AuthenticationError('Missing x-tenant-id header');
    }

    return { tenantId };
  }
}

// ── Provider registry ──────────────────────────────────────

let currentProvider: AuthProvider = new HeaderAuthProvider();

/**
 * Replace the active auth provider.
 *
 * Use this when switching from header-based auth to JWT, session, etc.
 *
 * @example
 * ```ts
 * setAuthProvider(new JwtAuthProvider({ secret: process.env.JWT_SECRET }));
 * ```
 */
export function setAuthProvider(provider: AuthProvider): void {
  currentProvider = provider;
}

/**
 * Get the active auth provider.
 */
export function getAuthProvider(): AuthProvider {
  return currentProvider;
}
