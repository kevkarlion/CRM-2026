import { type QuoteStatus } from '@/quotes/types/quote'

export function getStatusColor(status: string): string | null {
  const approvedStatuses = ['approved', 'accepted'];
  if (approvedStatuses.includes(status)) {
    return '#16A34A';
  }
  if (status === 'draft') {
    return '#6B7280';
  }
  return null;
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_VARIANT_MAP: Record<QuoteStatus, BadgeVariant> = {
  draft: 'neutral',
  sent: 'info',
  approved: 'success',
  rejected: 'danger',
  expired: 'warning',
  cancelled: 'danger',
  direct_sale: 'success',
}

const STATUS_LABEL_MAP: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  direct_sale: 'Venta Directa',
}

const variantClass: Record<BadgeVariant, string> = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  neutral: 'bg-gray-100 text-gray-700',
}

const dotClass: Record<BadgeVariant, string> = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-gray-400',
}

interface StatusBadgeProps {
  status: QuoteStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant = STATUS_VARIANT_MAP[status] ?? 'neutral'
  const label = STATUS_LABEL_MAP[status] ?? status

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${variantClass[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass[variant]}`} />
      {label}
    </span>
  )
}
