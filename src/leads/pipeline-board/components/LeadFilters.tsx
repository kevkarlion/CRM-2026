'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { IPipelineStage } from '../../types/pipeline';

interface LeadFiltersProps {
  stages: IPipelineStage[];
}

export function LeadFilters({ stages }: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assignedTo') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('createdAtGte') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('createdAtLte') || '');

  const [visibleStages, setVisibleStages] = useState<Set<string>>(() => {
    return new Set(stages.map((s) => s.name));
  });

  useEffect(() => {
    setVisibleStages(new Set(stages.map((s) => s.name)));
  }, [stages]);

  const pushParams = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsKey);
      for (const [key, value] of Object.entries(overrides)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParamsKey],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
    },
    [],
  );

  useEffect(() => {
    if (!search) {
      pushParams({ search: null });
      return;
    }
    const timer = setTimeout(() => {
      pushParams({ search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, pushParams]);

  const handleAssignedToChange = useCallback(
    (value: string) => {
      setAssignedTo(value);
      pushParams({ assignedTo: value || null });
    },
    [pushParams],
  );

  const handleDateFromChange = useCallback(
    (value: string) => {
      setDateFrom(value);
      pushParams({ createdAtGte: value || null });
    },
    [pushParams],
  );

  const handleDateToChange = useCallback(
    (value: string) => {
      setDateTo(value);
      pushParams({ createdAtLte: value || null });
    },
    [pushParams],
  );

  const toggleStage = useCallback((stageName: string) => {
    setVisibleStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageName)) {
        next.delete(stageName);
      } else {
        next.add(stageName);
      }
      return next;
    });
  }, []);

  const filterContent = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-search" className="text-xs text-gray-500 sr-only">
          Buscar
        </label>
        <input
          id="filter-search"
          type="text"
          placeholder="Buscar por nombre o empresa..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-assigned" className="text-xs text-gray-500">
          Asignado
        </label>
        <select
          id="filter-assigned"
          value={assignedTo}
          onChange={(e) => handleAssignedToChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        >
          <option value="">Todos</option>
          {/* TODO: fetch users from /api/crm/users */}
          <option value="placeholder" disabled>
            Cargar usuarios...
          </option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-date-from" className="text-xs text-gray-500">
          Desde
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-date-to" className="text-xs text-gray-500">
          Hasta
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Etapas</span>
        {stages.map((stage) => (
          <label
            key={stage.name}
            className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={visibleStages.has(stage.name)}
              onChange={() => toggleStage(stage.name)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-400"
            />
            {stage.name}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
        {filterContent}
      </div>

      <button
        onClick={() => setMobileOpen(true)}
        className="sm:hidden flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white text-sm text-gray-600"
        aria-label="Filtros"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filtros
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-sm text-brand-600 font-medium"
              >
                Aplicar
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}
    </>
  );
}
