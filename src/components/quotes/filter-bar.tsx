'use client';

import type { FilterState } from '@/quotes/types/client-quote-types';

const AVAILABLE_STATUSES = [
  'draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled',
  'open', 'counteroffer_made', 'accepted',
];

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

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function toggleStatus(status: string) {
    const next = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: next });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                filters.status.includes(status)
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-600/30'
                  : 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100'
              }`}
            >
              {STATUS_LABELS[status] ?? status}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={filters.client}
          onChange={e => onChange({ ...filters, client: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none w-40"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Asignado a</label>
        <input
          type="text"
          placeholder="Nombre..."
          value={filters.assignedTo}
          onChange={e => onChange({ ...filters, assignedTo: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none w-36"
        />
      </div>
    </div>
  );
}
