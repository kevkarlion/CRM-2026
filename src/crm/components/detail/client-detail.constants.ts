export const CLIENT_STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospecto' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Bloqueado' },
];

export const CLIENT_STATUS_VARIANT: Record<string, string> = {
  prospect: 'bg-brand-50 border-brand-200 text-brand-700',
  active: 'bg-success-50 border-success-200 text-success-700',
  inactive: 'bg-gray-50 border-gray-200 text-gray-500',
  blocked: 'bg-danger-50 border-danger-200 text-danger-700',
};

export const CLIENT_STATUS_DOT_COLOR: Record<string, string> = {
  prospect: 'bg-brand-500',
  active: 'bg-success-500',
  inactive: 'bg-gray-400',
  blocked: 'bg-danger-500',
};

export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  residential: 'Residencial',
  commercial: 'Comercial',
  industrial: 'Industrial',
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  direct_sale: 'Venta Directa',
};

export const QUOTE_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-success-50 text-success-700',
  rejected: 'bg-danger-50 text-danger-700',
  expired: 'bg-warning-50 text-warning-700',
  cancelled: 'bg-gray-100 text-gray-500',
  direct_sale: 'bg-success-50 text-success-700',
};

export function formatLongDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `$${value.toLocaleString()}`;
}

export function clientName(client: { fullName?: string; companyName?: string }): string {
  return client.companyName || client.fullName || '—';
}

/**
 * Renders the display name of a User reference inside block history entries.
 * Accepts the id (when the ref is not populated) or a populated user object.
 */
export function blockUserName(ref: unknown): string {
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  const user = ref as { _id?: string; firstName?: string; lastName?: string; email?: string };
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.email || user._id || '—';
}
