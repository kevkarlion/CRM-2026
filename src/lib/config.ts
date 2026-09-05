export interface ObservabilityConfig {
  systemLogEnabled: boolean;
  sampleRate: number;
}

const DEFAULT_PROD_SAMPLE_RATE = 0.1;

/**
 * Reads + caches observability flags from the environment.
 * Pure and injectable for deterministic tests.
 */
export function getObservabilityConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityConfig {
  const isProd = env.NODE_ENV === 'production';
  const rawEnabled = env.OBSERVABILITY_SYSTEM_LOG_ENABLED;
  const systemLogEnabled =
    rawEnabled === undefined ? !isProd : rawEnabled === 'true' || rawEnabled === '1';
  const rawRate = Number(env.OBSERVABILITY_SAMPLE_RATE);
  const sampleRate =
    Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1
      ? rawRate
      : isProd
        ? DEFAULT_PROD_SAMPLE_RATE
        : 1;
  return { systemLogEnabled, sampleRate };
}

/**
 * Pure sampling decision. Disabled config never samples; otherwise the
 * random draw must fall within the configured rate.
 */
export function shouldSample(
  config: ObservabilityConfig,
  random: () => number = Math.random,
): boolean {
  if (!config.systemLogEnabled) return false;
  return random() <= config.sampleRate;
}

/**
 * Convenience combining config read + sampling decision for logger gates.
 */
export function shouldPersistSystemLog(
  env: NodeJS.ProcessEnv = process.env,
  random: () => number = Math.random,
): boolean {
  return shouldSample(getObservabilityConfig(env), random);
}
