export function formatDateSafe(isoString: string, locale: string = 'es-CL'): string {
  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function getDaysUntilExpiry(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const date = new Date(validUntil);
  const expiryDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDateShort(isoString: string, locale: string = 'es-CL'): string {
  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
