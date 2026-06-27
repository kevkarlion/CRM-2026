import mongoose from 'mongoose';
import SystemHealthModel from '../core/models/system-health';
import { HealthStatus } from '../core/types/system-health';

export interface HealthCheckResult {
  serviceName: string;
  status: HealthStatus;
  responseTimeMs: number;
  details?: Record<string, unknown>;
}

/**
 * Performs a health check on MongoDB connectivity.
 */
export async function checkMongoDB(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const isConnected = mongoose.connection.readyState === 1;

    if (!isConnected) {
      return {
        serviceName: 'mongodb',
        status: 'degraded',
        responseTimeMs: Date.now() - start,
        details: { message: 'MongoDB connection not ready', readyState: mongoose.connection.readyState },
      };
    }

    // Verify with a ping command
    await mongoose.connection.db?.admin().ping();

    return {
      serviceName: 'mongodb',
      status: 'healthy',
      responseTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      serviceName: 'mongodb',
      status: 'down',
      responseTimeMs: Date.now() - start,
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Performs a health check on an external API.
 */
export async function checkExternalAPI(
  name: string,
  checkFn: () => Promise<boolean>,
  timeoutMs = 5000
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const timeout = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );

    const healthy = await Promise.race([checkFn(), timeout]);

    return {
      serviceName: name,
      status: healthy ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      serviceName: name,
      status: 'down',
      responseTimeMs: Date.now() - start,
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Runs all health checks and persists the results.
 */
export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // MongoDB
  results.push(await checkMongoDB());

  // Persist each result
  for (const result of results) {
    try {
      await SystemHealthModel.create({
        serviceName: result.serviceName,
        status: result.status,
        responseTimeMs: result.responseTimeMs,
        details: result.details,
        lastCheckAt: new Date(),
      });
    } catch (error) {
      console.error(`[HealthCheck] Failed to persist ${result.serviceName}:`, error);
    }
  }

  return results;
}

/**
 * Returns the latest health status for all services.
 */
export async function getLatestHealthStatus(): Promise<HealthCheckResult[]> {
  const services = await SystemHealthModel.distinct('serviceName');
  const results: HealthCheckResult[] = [];

  for (const serviceName of services) {
    const latest = await SystemHealthModel.findOne({ serviceName })
      .sort({ createdAt: -1 })
      
      .exec();

    if (latest) {
      results.push({
        serviceName: latest.serviceName,
        status: latest.status,
        responseTimeMs: latest.responseTimeMs,
        details: latest.details || undefined,
      });
    }
  }

  return results;
}
