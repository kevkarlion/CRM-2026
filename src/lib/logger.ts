export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_PREFIX = 'CRM';

/**
 * Resolves the effective log level from the environment.
 * Prefers LOG_LEVEL when valid; falls back to warn in production, debug otherwise.
 */
export function getLogLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const raw = (env.LOG_LEVEL || '').toLowerCase();
  if (raw in LEVEL_RANK) return raw as LogLevel;
  return env.NODE_ENV === 'production' ? 'warn' : 'debug';
}

/**
 * Whether a message at `level` should be emitted for the given environment.
 */
export function shouldLog(level: LogLevel, env: NodeJS.ProcessEnv = process.env): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[getLogLevel(env)];
}

/**
 * Emits a leveled, env-gated log line. No-op when the level is disabled.
 */
export function log(level: LogLevel, message: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!shouldLog(level, env)) return;
  const writer =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.debug;
  writer(`[${LOG_PREFIX}]`, `[${level.toUpperCase()}]`, message);
}
