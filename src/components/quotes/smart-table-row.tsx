'use client';

import Link from 'next/link';
import { formatDateShort, getDaysUntilExpiry } from '@/lib/format-date';
import { getNextAction, NextActionBadge } from './next-action-badge';
import { getExpiryBadge, ExpiryBadge } from './expiry-badge';
import { getStatusColor } from './status-color';
import type { QuoteTableRow } from '@/quotes/types/client-quote-types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  open: 'Abierta',
  counteroffer_made: 'Contraoferta',
  accepted: 'Aceptada',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function renderDaysUntilExpiry(validUntil: string | null): string {
  if (!validUntil) return '—';
  const days = getDaysUntilExpiry(validUntil);
  if (days === null) return '—';
  if (days < 0) return `Vencida hace ${Math.abs(days)} días`;
  if (days === 0) return 'Vence hoy';
  return `Vence en ${days} día${days === 1 ? '' : 's'}`;
}

function renderTotal(total: number | null): string {
  if (total == null) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total);
}

interface SmartTableRowProps {
  row: QuoteTableRow;
}

export function SmartTableRow({ row }: SmartTableRowProps) {
  const href = row.entityType === 'quote' ? `/quotes/${row.id}` : `/negotiations/${row.id}`;
  const nextAction = getNextAction({
    status: row.entityStatus,
    entityType: row.entityType,
    validUntil: row.validUntil,
    workOrderStatus: row.workOrderStatus,
    leadStatus: row.leadStatus,
  });
  const statusColor = getStatusColor(row.status);
  const validDate = row.validUntil ? formatDateShort(row.validUntil) : null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-3">
        <Link href={href} className="block">
          <p className="text-sm font-medium text-gray-900">{row.clientName}</p>
          {row.companyName && (
            <p className="text-xs text-gray-500">{row.companyName}</p>
          )}
        </Link>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm text-gray-600">
          {row.entityType === 'quote' ? 'Cotización' : 'Negociación'}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <span
            className="text-sm"
            style={statusColor ? { color: statusColor } : undefined}
          >
            {STATUS_LABELS[row.status] ?? row.status}
          </span>
          <ExpiryBadge entity={{ status: row.entityStatus, validUntil: row.validUntil }} />
        </div>
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-900">
        {renderTotal(row.total)}
      </td>
      <td className="hidden lg:table-cell px-3 py-3">
        {validDate ? (
          <div className="text-sm text-gray-600">
            <p>{validDate}</p>
            <p className="text-xs text-gray-400">{renderDaysUntilExpiry(row.validUntil)}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <NextActionBadge type={nextAction.type} label={nextAction.label} />
      </td>
      <td className="hidden lg:table-cell px-3 py-3">
        {row.assignedName ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {getInitials(row.assignedName)}
            </span>
            <span className="text-sm text-gray-600">{row.assignedName}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}
