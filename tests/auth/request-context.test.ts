import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestLike } from '../../src/core/auth';
import {
  getCurrentUser,
  getCurrentTenant,
  setAuthProvider,
  HeaderAuthProvider,
  AuthenticationError,
} from '../../src/core/auth';

// ── Helpers ────────────────────────────────────────────────

function createMockRequest(headers: Record<string, string>): RequestLike {
  return {
    headers: {
      get(name: string): string | null {
        return headers[name] ?? null;
      },
    },
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('getCurrentUser', () => {
  beforeEach(() => {
    setAuthProvider(new HeaderAuthProvider());
  });

  it('extracts userId and tenantId from headers', async () => {
    const request = createMockRequest({
      'x-user-id': 'user-123',
      'x-tenant-id': 'tenant-456',
    });

    const user = await getCurrentUser(request);

    expect(user.userId).toBe('user-123');
    expect(user.tenantId).toBe('tenant-456');
  });

  it('returns empty roles and permissions array (header provider)', async () => {
    const request = createMockRequest({
      'x-user-id': 'user-123',
      'x-tenant-id': 'tenant-456',
    });

    const user = await getCurrentUser(request);

    expect(user.roles).toEqual([]);
    expect(user.permissions).toEqual([]);
  });

  it('throws AuthenticationError when x-user-id is missing', async () => {
    const request = createMockRequest({
      'x-tenant-id': 'tenant-456',
    });

    await expect(getCurrentUser(request)).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError when x-tenant-id is missing', async () => {
    const request = createMockRequest({
      'x-user-id': 'user-123',
    });

    await expect(getCurrentUser(request)).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError when both headers are missing', async () => {
    const request = createMockRequest({});

    await expect(getCurrentUser(request)).rejects.toThrow(AuthenticationError);
  });

  it('throws with 401 status code', async () => {
    const request = createMockRequest({});

    try {
      await getCurrentUser(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationError);
      expect((error as AuthenticationError).statusCode).toBe(401);
    }
  });
});

describe('getCurrentTenant', () => {
  beforeEach(() => {
    setAuthProvider(new HeaderAuthProvider());
  });

  it('extracts tenantId from header', async () => {
    const request = createMockRequest({
      'x-tenant-id': 'tenant-789',
    });

    const { tenantId } = await getCurrentTenant(request);

    expect(tenantId).toBe('tenant-789');
  });

  it('throws AuthenticationError when x-tenant-id is missing', async () => {
    const request = createMockRequest({});

    await expect(getCurrentTenant(request)).rejects.toThrow(AuthenticationError);
  });
});

describe('setAuthProvider / getAuthProvider', () => {
  it('uses HeaderAuthProvider by default', async () => {
    const request = createMockRequest({
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
    });

    const user = await getCurrentUser(request);
    expect(user.userId).toBe('user-1');
  });

  it('allows swapping to a custom provider', async () => {
    const customProvider = new (class implements import('../../src/core/auth').AuthProvider {
      async extractUser() {
        return { userId: 'custom-user', tenantId: 'custom-tenant', roles: ['admin'], permissions: [] };
      }
      async extractTenant() {
        return { tenantId: 'custom-tenant' };
      }
    })();

    setAuthProvider(customProvider);

    const request = createMockRequest({});
    const user = await getCurrentUser(request);

    expect(user.userId).toBe('custom-user');
    expect(user.roles).toContain('admin');

    // Reset for other tests
    setAuthProvider(new HeaderAuthProvider());
  });
});

describe('withAuth wrapper', () => {
  beforeEach(() => {
    setAuthProvider(new HeaderAuthProvider());
  });

  it('extracts user and passes it to handler', async () => {
    const { withAuth } = await import('../../src/core/auth/with-auth');

    const handler = withAuth(async (_request, { user }) => {
      return new Response(JSON.stringify({ userId: user.userId, tenantId: user.tenantId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const request = createMockRequest({
      'x-user-id': 'user-99',
      'x-tenant-id': 'tenant-99',
    });

    const response = await handler(request, { params: {} });
    const body = await response.json();

    expect(body.userId).toBe('user-99');
    expect(body.tenantId).toBe('tenant-99');
  });

  it('returns 401 when auth headers are missing', async () => {
    const { withAuth } = await import('../../src/core/auth/with-auth');

    const handler = withAuth(async (_request, { user }) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const request = createMockRequest({});
    const response = await handler(request, { params: {} });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Missing authentication headers');
  });
});
