import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createMock = vi.fn();

vi.mock('../../src/core/models/request-log', () => ({
  default: { create: (...args: unknown[]) => createMock(...args) },
}));

vi.mock('../../src/core/models/system-log', () => ({
  default: { create: (...args: unknown[]) => createMock(...args) },
}));

vi.mock('../../src/core/models/error-event', () => ({
  default: { create: (...args: unknown[]) => createMock(...args) },
}));

import { logRequest } from '@/observability/request-logger';
import { logSystemEvent } from '@/observability/system-logger';
import { trackError } from '@/observability/error-tracker';

const baseRequest = {
  method: 'GET',
  endpoint: '/api/test',
  duration: 12,
  statusCode: 200,
  ipAddress: '127.0.0.1',
};

const baseSystem = {
  level: 'info' as 'info',
  service: 'crm',
  message: 'hello',
};

beforeEach(() => {
  createMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('observability sampling gates', () => {
  it('logRequest skips persistence when sampling says no (prod default disabled)', async () => {
    const spy = vi
      .spyOn(await import('../../src/lib/config'), 'shouldPersistSystemLog')
      .mockReturnValue(false);
    await logRequest(baseRequest);
    expect(createMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logRequest persists when enabled and sampled (dev full rate)', async () => {
    const spy = vi
      .spyOn(await import('../../src/lib/config'), 'shouldPersistSystemLog')
      .mockReturnValue(true);
    await logRequest(baseRequest);
    expect(createMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('logSystemEvent skips when sampling says no', async () => {
    const spy = vi
      .spyOn(await import('../../src/lib/config'), 'shouldPersistSystemLog')
      .mockReturnValue(false);
    await logSystemEvent(baseSystem);
    expect(createMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logSystemEvent persists when sampled', async () => {
    const spy = vi
      .spyOn(await import('../../src/lib/config'), 'shouldPersistSystemLog')
      .mockReturnValue(true);
    await logSystemEvent(baseSystem);
    expect(createMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('trackError is never gated and always persists', async () => {
    await trackError({ service: 'crm', severity: 'high', message: 'boom' });
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
