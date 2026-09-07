export function normalizePhone(input: string): string {
  const cleaned = input
    .replace(/%2B/g, '+')
    .replace(/[\s\-()\\+]/g, '')
    .replace(/^0/, '');
  const digits = cleaned.replace(/[^\d]/g, '');

  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return '549' + digits;
  if (digits.length === 10) return '549' + digits;
  return digits;
}