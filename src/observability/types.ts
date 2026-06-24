/**
 * Structured context for error events and log entries.
 *
 * Provides consistent metadata across all observability functions
 * so errors can be correlated by request, user, tenant, and action.
 */
export interface ErrorContext {
  /** Business action being performed (e.g. "lead.create", "quote.list") */
  action: string;
  /** Authenticated user identifier */
  userId?: string;
  /** Active tenant identifier */
  tenantId?: string;
  /** Unique request identifier for cross-reference */
  requestId: string;
  /** When the error occurred */
  timestamp: Date;
}

/**
 * Enriched request context, created at the start of each request.
 *
 * Provides a consistent requestId and timestamp, plus an `enrich()`
 * helper that builds a complete ErrorContext with action/user context.
 */
export interface RequestEnrichment {
  /** Unique identifier for this request */
  requestId: string;
  /** When the request started */
  timestamp: Date;
  /**
   * Create a complete ErrorContext by merging request-level defaults
   * with action-specific context.
   */
  enrich(partial: Partial<ErrorContext>): ErrorContext;
}
