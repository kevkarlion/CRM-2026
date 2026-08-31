'use client';

import type { FilterState } from '@/quotes/types/client-quote-types';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
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
