import { describe, it, expect, vi } from 'vitest';

// ── Activity Logger ──────────────────────────────────────────
describe('ActivityLogger', () => {
  it('exports logActivity function', async () => {
    const { logActivity } = await import('../src/audit/activity-logger');
    expect(logActivity).toBeDefined();
    expect(typeof logActivity).toBe('function');
  });

  it('exports getEntityHistory function', async () => {
    const { getEntityHistory } = await import('../src/audit/activity-logger');
    expect(getEntityHistory).toBeDefined();
    expect(typeof getEntityHistory).toBe('function');
  });

  it('exports getTenantActivityFeed function', async () => {
    const { getTenantActivityFeed } = await import('../src/audit/activity-logger');
    expect(getTenantActivityFeed).toBeDefined();
    expect(typeof getTenantActivityFeed).toBe('function');
  });
});

// ── Security Logger ──────────────────────────────────────────
describe('SecurityLogger', () => {
  it('exports logSecurityEvent function', async () => {
    const { logSecurityEvent } = await import('../src/security/security-logger');
    expect(logSecurityEvent).toBeDefined();
    expect(typeof logSecurityEvent).toBe('function');
  });

  it('exports getTenantSecurityLog function', async () => {
    const { getTenantSecurityLog } = await import('../src/security/security-logger');
    expect(getTenantSecurityLog).toBeDefined();
  });

  it('exports getFailedLoginAttempts function', async () => {
    const { getFailedLoginAttempts } = await import('../src/security/security-logger');
    expect(getFailedLoginAttempts).toBeDefined();
  });
});

// ── System Logger ────────────────────────────────────────────
describe('SystemLogger', () => {
  it('exports logError, logWarn, logInfo functions', async () => {
    const mod = await import('../src/observability/system-logger');
    expect(typeof mod.logError).toBe('function');
    expect(typeof mod.logWarn).toBe('function');
    expect(typeof mod.logInfo).toBe('function');
  });
});

// ── Request Logger ───────────────────────────────────────────
describe('RequestLogger', () => {
  it('exports logRequest function', async () => {
    const { logRequest } = await import('../src/observability/request-logger');
    expect(logRequest).toBeDefined();
    expect(typeof logRequest).toBe('function');
  });

  it('exports createRequestLogEntry factory', async () => {
    const { createRequestLogEntry } = await import('../src/observability/request-logger');
    const entry = createRequestLogEntry('GET', '/api/health', 200, 42, {
      ipAddress: '127.0.0.1',
    });

    expect(entry.method).toBe('GET');
    expect(entry.endpoint).toBe('/api/health');
    expect(entry.statusCode).toBe(200);
    expect(entry.duration).toBe(42);
    expect(entry.ipAddress).toBe('127.0.0.1');
  });
});

// ── Error Tracker ────────────────────────────────────────────
describe('ErrorTracker', () => {
  it('exports trackError function', async () => {
    const { trackError } = await import('../src/observability/error-tracker');
    expect(trackError).toBeDefined();
  });

  it('exports updateErrorStatus function', async () => {
    const { updateErrorStatus } = await import('../src/observability/error-tracker');
    expect(updateErrorStatus).toBeDefined();
  });

  it('exports getOpenErrors function', async () => {
    const { getOpenErrors } = await import('../src/observability/error-tracker');
    expect(getOpenErrors).toBeDefined();
  });
});
