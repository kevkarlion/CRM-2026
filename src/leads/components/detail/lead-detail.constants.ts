import { LEAD_STATUS_LABELS } from '@/leads/constants/lead-status.constants';

export const STATUS_OPTIONS = Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const STATUS_VARIANT: Record<string, string> = {
  new: 'bg-blue-50 border-blue-200 text-blue-700',
  contacted: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  quote_sent: 'bg-purple-50 border-purple-200 text-purple-700',
  technical_visit: 'bg-orange-50 border-orange-200 text-orange-700',
  negotiation: 'bg-amber-50 border-amber-200 text-amber-700',
  qualified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  won: 'bg-green-50 border-green-200 text-green-700',
  lost: 'bg-red-50 border-red-200 text-red-700',
  disqualified: 'bg-gray-50 border-gray-200 text-gray-500',
};

export const STATUS_DOT_COLOR: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-indigo-500',
  quote_sent: 'bg-purple-500',
  technical_visit: 'bg-orange-500',
  negotiation: 'bg-amber-500',
  qualified: 'bg-emerald-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
  disqualified: 'bg-gray-400',
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

export const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  call: 'Llamada',
  form: 'Formulario',
  referral: 'Referido',
  walk_in: 'Presencial',
  other: 'Otro',
};

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `$${value.toLocaleString()}`;
}
