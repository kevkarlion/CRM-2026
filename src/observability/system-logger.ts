import { Types } from 'mongoose';
import SystemLogModel from '../models/system-log';
import { LogLevel } from '../types/system-log';

export interface SystemLogEntry {
  level: LogLevel;
  service: string;
  message: string;
  stacktrace?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | Types.ObjectId;
}

/**
 * Logs a system event to the SystemLog collection.
 *
 * Use for: backend errors, integration failures, MongoDB errors,
 * SMTP errors, WhatsApp errors, and any service-level events.
 */
export async function logSystemEvent(entry: SystemLogEntry): Promise<void> {
  try {
    await SystemLogModel.create({
      level: entry.level,
      service: entry.service,
      message: entry.message,
      stacktrace: entry.stacktrace,
      metadata: entry.metadata,
      tenantId: entry.tenantId || undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    // Fail silently — if the logger itself fails, we log to console
    console.error('[SystemLogger] Failed to persist log entry:', error);
  }
}

/**
 * Logs an error-level system event.
 */
export function logError(
  service: string,
  message: string,
  options?: {
    stacktrace?: string;
    metadata?: Record<string, unknown>;
    tenantId?: string | Types.ObjectId;
  }
): Promise<void> {
  return logSystemEvent({
    level: 'error',
    service,
    message,
    stacktrace: options?.stacktrace,
    metadata: options?.metadata,
    tenantId: options?.tenantId,
  });
}

/**
 * Logs a warning-level system event.
 */
export function logWarn(
  service: string,
  message: string,
  options?: {
    metadata?: Record<string, unknown>;
    tenantId?: string | Types.ObjectId;
  }
): Promise<void> {
  return logSystemEvent({
    level: 'warn',
    service,
    message,
    metadata: options?.metadata,
    tenantId: options?.tenantId,
  });
}

/**
 * Logs an info-level system event.
 */
export function logInfo(
  service: string,
  message: string,
  options?: {
    metadata?: Record<string, unknown>;
    tenantId?: string | Types.ObjectId;
  }
): Promise<void> {
  return logSystemEvent({
    level: 'info',
    service,
    message,
    metadata: options?.metadata,
    tenantId: options?.tenantId,
  });
}
