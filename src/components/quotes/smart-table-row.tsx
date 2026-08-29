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
    <tr className="border-b border-gray-100 even:bg-gray-100/50 odd:bg-white hover:bg-brand-50/40 transition-colors">
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

/**
 * QuoteMobileCard - Mobile card for the work tray table.
 * Uses the same row data and helpers as SmartTableRow, rendered
 * as a touch-friendly card below `sm`.
 */
export function QuoteMobileCard({ row }: SmartTableRowProps) {
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
  const daysUntil = getDaysUntilExpiry(row.validUntil);

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 border-l-4 rounded-xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow"
      style={statusColor ? { borderLeftColor: statusColor } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{row.clientName}</p>
          {row.companyName && (
            <p className="text-sm text-gray-500 truncate">{row.companyName}</p>
          )}
        </div>
        <span
          className="text-sm font-medium shrink-0"
          style={statusColor ? { color: statusColor } : undefined}
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</span>
          <span className="block text-sm font-semibold text-gray-900 tabular-nums">{renderTotal(row.total)}</span>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Vencimiento</span>
          <span className="block text-sm font-medium text-gray-900">{validDate || '—'}</span>
          {validDate && (
            <span className={`block text-[10px] ${daysUntil !== null && daysUntil < 0 ? 'font-medium text-rose-600' : 'text-gray-400'}`}>
              {renderDaysUntilExpiry(row.validUntil)}
            </span>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Asignado</span>
          <span className="block text-sm font-medium text-gray-900 truncate">{row.assignedName || '—'}</span>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tipo</span>
          <span className="block text-sm font-medium text-gray-900">{ENTITY_LABELS[row.entityType] || row.entityType}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <NextActionBadge type={nextAction.type} label={nextAction.label} />
        <span className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
          Ver
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
