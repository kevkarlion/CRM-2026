import { Types } from 'mongoose';
import RequestLogModel from '../models/request-log';

export interface RequestLogEntry {
  method: string;
  endpoint: string;
  duration: number;
  statusCode: number;
  tenantId?: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
}

/**
 * Logs an HTTP request to the RequestLog collection.
 *
 * RequestLog has a TTL index on `timestamp` (default 30 days)
 * that automatically deletes expired entries.
 *
 * Use as middleware in Next.js API routes or route handlers.
 */
export async function logRequest(entry: RequestLogEntry): Promise<void> {
  try {
    await RequestLogModel.create({
      method: entry.method,
      endpoint: entry.endpoint,
      duration: entry.duration,
      statusCode: entry.statusCode,
      tenantId: entry.tenantId || undefined,
      userId: entry.userId || undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    // Fail silently — request logging should never crash the app
    console.error('[RequestLogger] Failed to persist request log:', error);
  }
}

/**
 * Express/Next.js middleware-style wrapper.
 * Returns request duration on completion.
 *
 * Usage in Next.js API route:
 *   const start = Date.now();
 *   // ... handle request
 *   await logRequest({ method, endpoint, duration: Date.now() - start, ... });
 */
export function createRequestLogEntry(
  method: string,
  endpoint: string,
  statusCode: number,
  duration: number,
  options?: {
    tenantId?: string | Types.ObjectId;
    userId?: string | Types.ObjectId;
    ipAddress?: string;
    userAgent?: string;
  }
): RequestLogEntry {
  return {
    method,
    endpoint,
    duration,
    statusCode,
    tenantId: options?.tenantId,
    userId: options?.userId,
    ipAddress: options?.ipAddress || '0.0.0.0',
    userAgent: options?.userAgent,
  };
}
