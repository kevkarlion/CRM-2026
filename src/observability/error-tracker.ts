import { Types } from 'mongoose';
import ErrorEventModel from '../core/models/error-event';
import { ErrorSeverity, ErrorStatus } from '../core/types/error-event';
import type { ErrorContext } from './types';

export interface ErrorEventInput {
  service: string;
  severity: ErrorSeverity;
  message: string;
  stacktrace?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | Types.ObjectId;
}

/**
 * Creates a new error event for centralized tracking.
 */
export async function trackError(input: ErrorEventInput): Promise<void> {
  try {
    await ErrorEventModel.create({
      service: input.service,
      severity: input.severity,
      message: input.message,
      stacktrace: input.stacktrace,
      metadata: input.metadata,
      tenantId: input.tenantId || undefined,
      status: 'open',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[ErrorTracker] Failed to persist error event:', error);
  }
}

/**
 * Updates the resolution status of an error event.
 */
export async function updateErrorStatus(
  errorEventId: string | Types.ObjectId,
  status: ErrorStatus,
  options?: {
    assignedTo?: string | Types.ObjectId;
    resolvedAt?: Date;
  }
): Promise<boolean> {
  try {
    const update: Record<string, unknown> = { status };

    if (options?.assignedTo) {
      update.assignedTo = options.assignedTo;
    }

    if (status === 'resolved' || status === 'dismissed') {
      update.resolvedAt = options?.resolvedAt || new Date();
    }

    const result = await ErrorEventModel.updateOne(
      { _id: errorEventId },
      { $set: update }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[ErrorTracker] Failed to update error status:', error);
    return false;
  }
}

/**
 * Assigns an error event to a platform user.
 */
export async function assignError(
  errorEventId: string | Types.ObjectId,
  assignedTo: string | Types.ObjectId
): Promise<boolean> {
  return updateErrorStatus(errorEventId, 'in_progress', { assignedTo });
}

/**
 * Resolves an error event.
 */
export async function resolveError(
  errorEventId: string | Types.ObjectId
): Promise<boolean> {
  return updateErrorStatus(errorEventId, 'resolved', {
    resolvedAt: new Date(),
  });
}

/**
 * Dismisses an error event (false positive, not actionable).
 */
export async function dismissError(
  errorEventId: string | Types.ObjectId
): Promise<boolean> {
  return updateErrorStatus(errorEventId, 'dismissed', {
    resolvedAt: new Date(),
  });
}

/**
 * Retrieves open/high-severity errors for a tenant.
 */
export async function getOpenErrors(
  tenantId: string | Types.ObjectId,
  options?: { severity?: ErrorSeverity; limit?: number }
): Promise<unknown[]> {
  const filter: Record<string, unknown> = {
    tenantId,
    status: { $in: ['open', 'in_progress'] },
  };

  if (options?.severity) {
    filter.severity = options.severity;
  }

  return ErrorEventModel.find(filter)
    .sort({ severity: 1, timestamp: -1 })
    .limit(options?.limit || 20)
    
    .exec();
}

// ── Context-aware wrapper ──────────────────────────────────

/**
 * Track an error with full ErrorContext.
 *
 * This is the context-aware version of `trackError()`.
 * It extracts tenantId and action from the ErrorContext and
 * enriches metadata with requestId and action information.
 */
export async function trackErrorWithContext(
  input: Omit<ErrorEventInput, 'tenantId'>,
  context: ErrorContext,
): Promise<void> {
  return trackError({
    ...input,
    tenantId: context.tenantId,
    metadata: {
      ...input.metadata,
      requestId: context.requestId,
      action: context.action,
      userId: context.userId,
    },
  });
}
