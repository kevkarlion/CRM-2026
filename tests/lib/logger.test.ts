import { describe, it, expect, vi, afterEach } from 'vitest';
import { shouldLog, getLogLevel, log } from '@/lib/logger';
import type { LogLevel } from '@/lib/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger level/env gating', () => {
  describe('getLogLevel', () => {
    it('reads LOG_LEVEL when set to a valid level', () => {
      expect(getLogLevel({ LOG_LEVEL: 'error', NODE_ENV: 'development' })).toBe('error');
    });

    it('defaults to warn in production when LOG_LEVEL is absent', () => {
      expect(getLogLevel({ NODE_ENV: 'production' })).toBe('warn');
    });

    it('defaults to debug in non-production when LOG_LEVEL is absent', () => {
      expect(getLogLevel({ NODE_ENV: 'development' })).toBe('debug');
    });

    it('ignores an invalid LOG_LEVEL and falls back to the env default', () => {
      expect(getLogLevel({ LOG_LEVEL: 'verbose', NODE_ENV: 'production' })).toBe('warn');
    });
  });

  describe('shouldLog', () => {
    it('logs debug in dev default (debug)', () => {
      expect(shouldLog('debug', { NODE_ENV: 'development' })).toBe(true);
    });

    it('suppresses info when LOG_LEVEL is error', () => {
      expect(shouldLog('info', { LOG_LEVEL: 'error', NODE_ENV: 'production' })).toBe(false);
    });

    it('logs error when LOG_LEVEL is error', () => {
      expect(shouldLog('error', { LOG_LEVEL: 'error', NODE_ENV: 'production' })).toBe(true);
    });

    it('suppresses debug/info in prod default (warn) but keeps warn/error', () => {
      const env = { NODE_ENV: 'production' };
      expect(shouldLog('debug', env)).toBe(false);
      expect(shouldLog('info', env)).toBe(false);
      expect(shouldLog('warn', env)).toBe(true);
      expect(shouldLog('error', env)).toBe(true);
    });
  });

  describe('log emits only when the level is enabled', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const spyKey: Record<LogLevel, keyof Pick<Console, 'debug' | 'info' | 'warn' | 'error'>> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
    };

    it('writes to the matching console method for every enabled level in debug env', () => {
      for (const level of levels) {
        const spy = vi.spyOn(console, spyKey[level]).mockImplementation(() => {});
        log(level, `msg-${level}`, { NODE_ENV: 'development', LOG_LEVEL: 'debug' });
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls.some((c) => c.includes(`msg-${level}`))).toBe(true);
      }
    });

    it('emits only error when LOG_LEVEL is error, suppressing debug/info/warn', () => {
      const env = { NODE_ENV: 'production', LOG_LEVEL: 'error' };
      for (const level of ['debug', 'info', 'warn'] as LogLevel[]) {
        const spy = vi.spyOn(console, spyKey[level]).mockImplementation(() => {});
        log(level, `should-not-${level}`, env);
        expect(spy).not.toHaveBeenCalled();
      }
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'should-error', env);
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
