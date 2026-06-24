import { describe, it, expect } from 'vitest';
import { createRequestContext } from '../../src/observability/request-context';

function mockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        return headers[name] ?? null;
      },
    },
  };
}

describe('createRequestContext', () => {
  it('returns a requestId and timestamp', () => {
    const ctx = createRequestContext(mockRequest());

    expect(ctx.requestId).toBeDefined();
    expect(ctx.requestId.length).toBeGreaterThan(0);
    expect(ctx.timestamp).toBeInstanceOf(Date);
  });

  it('generates unique requestIds for each call', () => {
    const ctx1 = createRequestContext(mockRequest());
    const ctx2 = createRequestContext(mockRequest());

    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });

  it('enrich() builds a complete ErrorContext', () => {
    const ctx = createRequestContext(mockRequest());
    const errCtx = ctx.enrich({
      action: 'lead.create',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });

    expect(errCtx.action).toBe('lead.create');
    expect(errCtx.userId).toBe('user-1');
    expect(errCtx.tenantId).toBe('tenant-1');
    expect(errCtx.requestId).toBe(ctx.requestId);
    expect(errCtx.timestamp).toBe(ctx.timestamp);
  });

  it('enrich() defaults action to "unknown" when not provided', () => {
    const ctx = createRequestContext(mockRequest());
    const errCtx = ctx.enrich({});

    expect(errCtx.action).toBe('unknown');
  });

  it('enrich() preserves requestId and timestamp across calls', () => {
    const ctx = createRequestContext(mockRequest());

    const first = ctx.enrich({ action: 'first' });
    const second = ctx.enrich({ action: 'second', userId: 'user-2' });

    expect(first.requestId).toBe(ctx.requestId);
    expect(second.requestId).toBe(ctx.requestId);
    expect(first.timestamp).toBe(ctx.timestamp);
    expect(second.timestamp).toBe(ctx.timestamp);
    expect(first.action).toBe('first');
    expect(second.action).toBe('second');
    expect(second.userId).toBe('user-2');
  });
});

describe('handleRouteError', () => {
  it('returns 500 for unknown errors', async () => {
    const { handleRouteError } = await import('../../src/observability/error-handler');
    const ctx = createRequestContext(mockRequest()).enrich({ action: 'test' });

    const response = handleRouteError(new Error('something broke'), ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 and logs for plain Error objects', async () => {
    const { handleRouteError } = await import('../../src/observability/error-handler');
    const ctx = createRequestContext(mockRequest()).enrich({ action: 'test' });

    const response = handleRouteError(new Error('runtime failure'), ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });

  it('handles string errors gracefully', async () => {
    const { handleRouteError } = await import('../../src/observability/error-handler');
    const ctx = createRequestContext(mockRequest()).enrich({ action: 'test' });

    const response = handleRouteError('string error', ctx);

    expect(response.status).toBe(500);
  });

  it('maps known errors to appropriate status codes', async () => {
    class ValidationError extends Error {
      constructor(m: string) { super(m); this.name = 'ValidationError'; }
    }
    const { handleRouteError } = await import('../../src/observability/error-handler');
    const ctx = createRequestContext(mockRequest()).enrich({ action: 'test' });

    const response = handleRouteError(new ValidationError('invalid input'), ctx, [
      { type: ValidationError, status: 400 },
    ]);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid input');
  });

  it('returns JSON content-type', async () => {
    const { handleRouteError } = await import('../../src/observability/error-handler');
    const ctx = createRequestContext(mockRequest()).enrich({ action: 'test' });

    const response = handleRouteError(new Error('fail'), ctx);

    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
