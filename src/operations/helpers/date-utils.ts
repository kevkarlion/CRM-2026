/**
 * Parse a date string that may be YYYY-MM-DD or ISO datetime (with T).
 * Returns a local Date (midnight for date-only strings) to avoid timezone offset.
 */
export function parseLocalDate(dateStr?: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes('T')) {
    // ISO datetime from MongoDB Date type — parse directly
    return new Date(dateStr);
  }
  // YYYY-MM-DD string — construct at local midnight
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(0);
  return new Date(y, m - 1, d);
}

/**
 * Format a date string (YYYY-MM-DD or ISO) for display.
 * Handles both work order (String schema) and technical visit (Date schema) formats.
 */
export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = parseLocalDate(dateStr);
    if (date.getTime() === 0) return '—';
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDateLong(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = parseLocalDate(dateStr);
    if (date.getTime() === 0) return '—';
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDateMonthShort(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = parseLocalDate(dateStr);
    if (date.getTime() === 0) return '—';
    return date.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}
