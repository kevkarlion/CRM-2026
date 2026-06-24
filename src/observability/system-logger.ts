import { Types } from 'mongoose';
import SystemLogModel from '../core/models/system-log';
import { LogLevel } from '../types/system-log';
import type { ErrorContext } from './types';

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
// ── Context-aware wrappers ─────────────────────────────────
// These are additive — they do NOT modify existing functions.

/**
 * Log a system event with full ErrorContext.
 *
 * This is the context-aware version of `logSystemEvent()`.
 * It extracts tenantId and userId from the ErrorContext and
 * enriches metadata with requestId and action.
 */
export function logEventWithContext(
  level: LogLevel,
  service: string,
  message: string,
  context: ErrorContext,
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  return logSystemEvent({
    level,
    service,
    message,
    tenantId: context.tenantId,
    metadata: {
      requestId: context.requestId,
      action: context.action,
      userId: context.userId,
      ...extraMetadata,
    },
  });
}

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
