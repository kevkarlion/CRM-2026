import type { PermissionKey } from '@/rbac/permissions';

/**
 * Minimal request interface compatible with NextRequest (Next.js) and
 * the standard Web Request API.
 *
 * The auth module only needs access to headers — no routing, body, or URL
 * parsing. This keeps it framework-agnostic.
 */
export interface RequestLike {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Authenticated user context extracted from the request.
 */
export interface CurrentUser {
  /** Unique user identifier */
  userId: string;
  /** Active tenant for this request */
  tenantId: string;
  /** Role names assigned to the user */
  roles: string[];
  /** Resolved permission keys for the user within the active tenant */
  permissions: PermissionKey[];
}

/**
 * Tenant context extracted from the request.
 * Use this when only the tenant identity is needed (e.g., listing resources).
 */
export interface CurrentTenant {
  /** Active tenant identifier */
  tenantId: string;
}

/**
 * Auth provider interface.
 * Implementations extract user/tenant context from the incoming request.
 *
 * @example
 * ```ts
 * class JwtAuthProvider implements AuthProvider {
 *   async extractUser(request: RequestLike): Promise<CurrentUser> { ... }
 *   async extractTenant(request: RequestLike): Promise<CurrentTenant> { ... }
 * }
 * ```
 */
export interface AuthProvider {
  /** Extract authenticated user from request. Throws AuthenticationError if invalid. */
  extractUser(request: RequestLike): Promise<CurrentUser>;
  /** Extract tenant context from request. Throws AuthenticationError if missing. */
  extractTenant(request: RequestLike): Promise<CurrentTenant>;
}
