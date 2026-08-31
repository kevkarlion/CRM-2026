import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { isAdminRole, requireAdmin } from '../../src/rbac/api-helpers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development-secret-key',
);

async function signToken(role: string): Promise<string> {
  return new SignJWT({ roles: [role] })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
}

function mockRequest(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) headers.set('Authorization', authHeader);
  return { headers } as any;
}

describe('isAdminRole', () => {
  it('returns true for Owner', () => {
    expect(isAdminRole('Owner')).toBe(true);
  });

  it('returns true for Administrator', () => {
    expect(isAdminRole('Administrator')).toBe(true);
  });

  it('returns false for Supervisor', () => {
    expect(isAdminRole('Supervisor')).toBe(false);
  });

  it('returns false for null role', () => {
    expect(isAdminRole(null)).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const result = await requireAdmin(mockRequest());
    expect(result.status).toBe(401);
    expect(result.error).toBeTruthy();
  });

  it('returns 401 when token verification fails', async () => {
    const result = await requireAdmin(mockRequest('Bearer not-a-valid-token'));
    expect(result.status).toBe(401);
    expect(result.error).toBeTruthy();
  });

  it('returns 403 for a non-admin role', async () => {
    const token = await signToken('sales');
    const result = await requireAdmin(mockRequest(`Bearer ${token}`));
    expect(result.status).toBe(403);
    expect(result.error).toBeTruthy();
  });

  it('allows Owner role', async () => {
    const token = await signToken('owner');
    const result = await requireAdmin(mockRequest(`Bearer ${token}`));
    expect(result).toEqual({});
  });

  it('allows Administrator role', async () => {
    const token = await signToken('admin');
    const result = await requireAdmin(mockRequest(`Bearer ${token}`));
    expect(result).toEqual({});
  });
});