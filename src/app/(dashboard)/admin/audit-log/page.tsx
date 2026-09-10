'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, unwrapData } from '@/lib/api-client';
import { AuditLogFiltersBar } from '@/components/audit/audit-log-filters';
import { AuditLogTable } from '@/components/audit/audit-log-table';
import { AuditLogSkeleton, AuditLogSkeletonMobile } from '@/components/audit/audit-log-skeleton';
import type { AuditLogEntry, AuditLogResponse, AuditLogFilters } from '@/components/audit/audit-log-types';

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<AuditLogFilters>({
    search: '',
    action: undefined,
    entityType: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const mountedRef = useRef(false);

  const fetchLogs = useCallback(async (targetPage: number, overrideFilters?: Partial<AuditLogFilters>) => {
    try {
      setLoading(true);
      setError(null);

      const f = overrideFilters ? { ...filters, ...overrideFilters } : filters;
      const params: Record<string, string> = {
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      };
      if (f.search) params.search = f.search;
      if (f.action) params.action = f.action;
      if (f.entityType) params.entityType = f.entityType;
      if (f.dateFrom) params.dateFrom = f.dateFrom;
      if (f.dateTo) params.dateTo = f.dateTo;

      const result = await api.get<AuditLogResponse>('/api/crm/audit-log', params);
      const data = unwrapData<AuditLogEntry[]>(result);

      setEntries(data);
      setTotal((result as any).total ?? data.length);
      setTotalPages((result as any).totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar registros de auditoría');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchLogs(filters.page || 1);
      return;
    }
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, page: 1 }));
      fetchLogs(1, { page: 1 });
    }, filters.search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [filters.search, filters.action, filters.entityType, filters.dateFrom, filters.dateTo]);

  const handleFilterChange = useCallback((change: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...change }));
  }, []);

  const goToPage = useCallback((targetPage: number) => {
    setFilters((prev) => ({ ...prev, page: targetPage }));
    fetchLogs(targetPage);
  }, [fetchLogs]);

  const page = filters.page || 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bitácora de Auditoría</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total > 0 ? `${total} registros encontrados` : 'Registro histórico de todas las acciones en el sistema'}
        </p>
      </div>

      <AuditLogFiltersBar filters={filters} onFilterChange={handleFilterChange} />

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {loading ? (
        <>
          <AuditLogSkeleton />
          <AuditLogSkeletonMobile />
        </>
      ) : (
        <AuditLogTable entries={entries} loading={loading} />
      )}

      {total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm">
          <span className="text-gray-500">
            Mostrando {from}-{to} de {total} registros
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
