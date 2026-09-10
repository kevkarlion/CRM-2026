'use client';

import { SearchInput } from '@/components/ui/SearchInput';
import { ACTION_LABELS, ENTITY_TYPE_LABELS, type AuditLogFilters as Filters } from './audit-log-types';

interface AuditLogFiltersBarProps {
  filters: Filters;
  onFilterChange: (filters: Partial<Filters>) => void;
}

const SELECT_CLASS = 'rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white';

export function AuditLogFiltersBar({ filters, onFilterChange }: AuditLogFiltersBarProps) {
  const hasActiveFilters = filters.action || filters.entityType || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <SearchInput
        value={filters.search || ''}
        onChange={(search) => onFilterChange({ search })}
        placeholder="Buscar por actor, entidad o descripción..."
      />
      <select
        value={filters.action || ''}
        onChange={(e) => onFilterChange({ action: e.target.value || undefined })}
        className={SELECT_CLASS}
      >
        <option value="">Todas las acciones</option>
        {Object.entries(ACTION_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <select
        value={filters.entityType || ''}
        onChange={(e) => onFilterChange({ entityType: e.target.value || undefined })}
        className={SELECT_CLASS}
      >
        <option value="">Todas las entidades</option>
        {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined })}
        className={SELECT_CLASS}
        title="Fecha desde"
      />
      <input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onFilterChange({ dateTo: e.target.value || undefined })}
        className={SELECT_CLASS}
        title="Fecha hasta"
      />
      {hasActiveFilters && (
        <button
          onClick={() => onFilterChange({ search: '', action: undefined, entityType: undefined, dateFrom: undefined, dateTo: undefined, page: 1 })}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
