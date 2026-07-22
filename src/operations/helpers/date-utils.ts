/**
 * Parse a date string that may be YYYY-MM-DD or ISO datetime (with T).
 * Returns a local Date (midnight for date-only strings) to avoid timezone offset.
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    // ISO datetime from MongoDB Date type — parse directly
    return new Date(dateStr);
  }
  // YYYY-MM-DD string — construct at local midnight
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a date string (YYYY-MM-DD or ISO) for display.
 * Handles both work order (String schema) and technical visit (Date schema) formats.
 */
export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  return parseLocalDate(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateLong(dateStr?: string): string {
  if (!dateStr) return '—';
  return parseLocalDate(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateMonthShort(dateStr?: string): string {
  if (!dateStr) return '—';
  return parseLocalDate(dateStr).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
  });
}
