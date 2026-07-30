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

/**
 * Calculate days remaining until a scheduled date.
 * Uses scheduledStart (ISO) if available, falls back to scheduledDate (YYYY-MM-DD).
 * Returns a label and Tailwind color variant, or null if no date.
 */
export function daysRemaining(
  scheduledStart?: string | null,
  scheduledDate?: string | null,
): { label: string; variant: string } | null {
  const dateStr = scheduledStart || scheduledDate;
  if (!dateStr) return null;

  const target = parseLocalDate(dateStr);
  if (target.getTime() === 0) return null;

  // Normalize both to local midnight so we compare whole days only
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 7) {
    return { label: `Vence en ${diffDays} días`, variant: 'bg-green-50 text-green-700 ring-green-600/20' };
  }
  if (diffDays >= 1) {
    return { label: `Vence en ${diffDays} días`, variant: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' };
  }
  if (diffDays === 0) {
    return { label: 'Vence hoy', variant: 'bg-red-50 text-red-700 ring-red-600/20' };
  }
  return { label: 'Vencido', variant: 'bg-red-50 text-red-700 ring-red-600/20' };
}
