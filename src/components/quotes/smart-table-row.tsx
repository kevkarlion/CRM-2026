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
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Curso',
  completed: 'Completada',
  converted_to_work_order: 'Convertida a OT',
  direct_sale: 'Venta Directa',
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

const ENTITY_LABELS: Record<string, string> = {
  quote: 'Presupuesto',
  negotiation: 'Negociación',
  technical_visit: 'Visita Técnica',
};

function getEntityHref(row: QuoteTableRow): string {
  switch (row.entityType) {
    case 'quote': return `/quotes/${row.id}`;
    case 'technical_visit': return `/technical-visits/${row.id}`;
    case 'negotiation': return `/negotiations/${row.id}`;
    default: return '#';
  }
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
  const href = getEntityHref(row);
  const nextAction = getNextAction({
    status: row.entityStatus,
    entityType: row.entityType,
    validUntil: row.validUntil,
    workOrderStatus: row.workOrderStatus,
    leadStatus: row.leadStatus,
    saleType: row.saleType,
  });
  const statusColor = getStatusColor(row.status);
  const validDate = row.validUntil ? formatDateShort(row.validUntil) : null;

  return (
    <tr className="border-b border-gray-100 hover:bg-brand-50/40 transition-colors">
      <td className="px-2 py-1.5 align-middle">
        <p className="text-xs font-medium text-gray-900">{row.clientName}</p>
        {row.companyName && (
          <p className="text-xs text-gray-500">{row.companyName}</p>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <span className="text-xs text-gray-600">
          {ENTITY_LABELS[row.entityType] || row.entityType}
        </span>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <div className="flex flex-col gap-1">
          <span
            className="text-xs"
            style={statusColor ? { color: statusColor } : undefined}
          >
            {STATUS_LABELS[row.status] ?? row.status}
          </span>
          <ExpiryBadge entity={{ status: row.entityStatus, validUntil: row.validUntil }} />
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 align-middle">
        {renderTotal(row.total)}
      </td>
      <td className="hidden lg:table-cell px-2 py-1.5 align-middle">
        {validDate ? (
          <div className="text-xs text-gray-600">
            <p>{validDate}</p>
            <p className="text-[10px] text-gray-400">{renderDaysUntilExpiry(row.validUntil)}</p>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <NextActionBadge type={nextAction.type} label={nextAction.label} />
      </td>
      <td className="hidden lg:table-cell px-2 py-1.5 align-middle">
        {row.assignedName ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-700">
              {getInitials(row.assignedName)}
            </span>
            <span className="text-xs text-gray-600">{row.assignedName}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <Link
          href={href}
          className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
        >
          Ver
        </Link>
      </td>
    </tr>
  );
}
