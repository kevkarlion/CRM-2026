import { describe, it, expect } from 'vitest';
import { shouldBlockDebugRoute } from '@/middleware';

describe('shouldBlockDebugRoute', () => {
  it('blocks /api/debug/** paths when debug routes are disabled', () => {
    expect(shouldBlockDebugRoute('/api/debug/health', false)).toBe(true);
    expect(shouldBlockDebugRoute('/api/debug/bot-state', false)).toBe(true);
    expect(shouldBlockDebugRoute('/api/debug', false)).toBe(true);
  });

  it('blocks exactly /api/admin/seed when debug routes are disabled', () => {
    expect(shouldBlockDebugRoute('/api/admin/seed', false)).toBe(true);
  });

  it('does not block other admin paths when debug routes are disabled', () => {
    expect(shouldBlockDebugRoute('/api/admin/users', false)).toBe(false);
    expect(shouldBlockDebugRoute('/api/admin/seed/extra', false)).toBe(false);
  });

  it('does not block public/non-debug paths', () => {
    expect(shouldBlockDebugRoute('/api/webhook', false)).toBe(false);
    expect(shouldBlockDebugRoute('/api/leads', false)).toBe(false);
  });

  it('allows debug routes when the flag is enabled', () => {
    expect(shouldBlockDebugRoute('/api/debug/health', true)).toBe(false);
    expect(shouldBlockDebugRoute('/api/admin/seed', true)).toBe(false);
  });
});
