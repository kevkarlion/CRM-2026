import { describe, it, expect } from 'vitest';
import { tenantScope } from './tenant-scope';

describe('tenantScope', () => {
  const tenantId = '507f1f77bcf86cd799439011';

  it('returns a filter with tenantId and excludes soft-deleted by default', () => {
    const scope = tenantScope(tenantId);

    expect(scope).toEqual({
      tenantId,
      deletedAt: null,
    });
  });

  it('omits deletedAt filter when includeDeleted is true', () => {
    const scope = tenantScope(tenantId, true);

    expect(scope).toEqual({
      tenantId,
    });
  });

  it('omits deletedAt filter when includeDeleted is false but explicitly set', () => {
    const scope = tenantScope(tenantId, false);

    expect(scope).toHaveProperty('deletedAt', null);
    expect(scope).toHaveProperty('tenantId', tenantId);
  });

  it('handles ObjectId-like string values', () => {
    const shortId = 'abc123';
    const scope = tenantScope(shortId);

    expect(scope.tenantId).toBe(shortId);
  });
});
