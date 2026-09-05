import { describe, it, expect } from 'vitest';
import {
  getObservabilityConfig,
  shouldSample,
  shouldPersistSystemLog,
} from '@/lib/config';

describe('getObservabilityConfig', () => {
  it('enables system logging in dev by default with full sampling', () => {
    const cfg = getObservabilityConfig({ NODE_ENV: 'development' });
    expect(cfg.systemLogEnabled).toBe(true);
    expect(cfg.sampleRate).toBe(1);
  });

  it('disables system logging in prod by default with 0.1 sampling', () => {
    const cfg = getObservabilityConfig({ NODE_ENV: 'production' });
    expect(cfg.systemLogEnabled).toBe(false);
    expect(cfg.sampleRate).toBe(0.1);
  });

  it('honours OBSERVABILITY_SYSTEM_LOG_ENABLED=true in prod', () => {
    const cfg = getObservabilityConfig({ NODE_ENV: 'production', OBSERVABILITY_SYSTEM_LOG_ENABLED: 'true' });
    expect(cfg.systemLogEnabled).toBe(true);
  });

  it('honours an explicit OBSERVABILITY_SAMPLE_RATE', () => {
    const cfg = getObservabilityConfig({ NODE_ENV: 'production', OBSERVABILITY_SAMPLE_RATE: '0.5' });
    expect(cfg.sampleRate).toBe(0.5);
  });

  it('clamps an out-of-range sample rate to the prod default', () => {
    const cfg = getObservabilityConfig({ NODE_ENV: 'production', OBSERVABILITY_SAMPLE_RATE: '2' });
    expect(cfg.sampleRate).toBe(0.1);
  });
});

describe('shouldSample', () => {
  it('returns false when system logging is disabled regardless of random', () => {
    expect(shouldSample({ systemLogEnabled: false, sampleRate: 1 }, () => 0)).toBe(false);
  });

  it('returns true when enabled and random falls within the rate', () => {
    expect(shouldSample({ systemLogEnabled: true, sampleRate: 0.5 }, () => 0.2)).toBe(true);
  });

  it('returns false when enabled but random exceeds the rate', () => {
    expect(shouldSample({ systemLogEnabled: true, sampleRate: 0.5 }, () => 0.9)).toBe(false);
  });
});

describe('shouldPersistSystemLog', () => {
  it('fully persists in dev (enabled at rate 1)', () => {
    expect(shouldPersistSystemLog({ NODE_ENV: 'development' }, () => 0.99)).toBe(true);
  });

  it('skips by default in prod (disabled)', () => {
    expect(shouldPersistSystemLog({ NODE_ENV: 'production' }, () => 0)).toBe(false);
  });
});
