'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { IPipelineStage } from '../../types/pipeline';

interface PipelineMetrics {
  total: number;
  calientes: number;
  handoffs: number;
  sinRespuesta: number;
}

interface LeadFiltersProps {
  stages: IPipelineStage[];
  metrics?: PipelineMetrics;
  onNewLead?: () => void;
  onExport?: () => void;
  onBulkAssign?: () => void;
  onViewActivity?: () => void;
}

export function LeadFilters({
  stages,
  metrics,
  onNewLead,
  onExport,
  onBulkAssign,
  onViewActivity,
}: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── State initialized from URL ──────────────────────────────────
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assignedTo') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('createdAtGte') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('createdAtLte') || '');
  const [isBotActive, setIsBotActive] = useState(searchParams.get('isBotActive') === 'true');
  const [isHandoff, setIsHandoff] = useState(searchParams.get('isHandoff') === 'true');
  const [scoreMin, setScoreMin] = useState(searchParams.get('scoreMin') || '');
  const [scoreMax, setScoreMax] = useState(searchParams.get('scoreMax') || '');
  const [lastContact, setLastContact] = useState(searchParams.get('lastContact') || '');
  const [source, setSource] = useState(searchParams.get('source') || '');
  const [service, setService] = useState(searchParams.get('service') || '');
  const [zone, setZone] = useState(searchParams.get('zone') || '');

  const [visibleStages, setVisibleStages] = useState<Set<string>>(() => {
    const param = searchParams.get('stages');
    if (param) return new Set(param.split(','));
    return new Set(stages.map((s) => s.name));
  });

  // ── Mount guard ─────────────────────────────────────────────────
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  // ── pushParams as ref (stable identity, always fresh closure) ───
  const pushParamsFn = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const pushRef = useRef(pushParamsFn);
  pushRef.current = pushParamsFn;

  const push = useCallback(
    (overrides: Record<string, string | null>) => pushRef.current(overrides),
    [],
  );

  // ── Search (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!search) { push({ search: null }); return; }
    const t = setTimeout(() => push({ search }), 300);
    return () => clearTimeout(t);
  }, [search, push]);

  // ── Stages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    const all = stages.map((s) => s.name);
    const active = all.filter((s) => visibleStages.has(s));
    push({ stages: active.length === all.length ? null : active.join(',') });
  }, [visibleStages, stages, push]);

  // ── Toggles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    push({
      isBotActive: isBotActive ? 'true' : null,
      isHandoff: isHandoff ? 'true' : null,
    });
  }, [isBotActive, isHandoff, push]);

  // ── Score (debounced) ───────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => push({ scoreMin: scoreMin || null }), 400);
    return () => clearTimeout(t);
  }, [scoreMin, push]);

  useEffect(() => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => push({ scoreMax: scoreMax || null }), 400);
    return () => clearTimeout(t);
  }, [scoreMax, push]);

  // ── Last contact ────────────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    push({ lastContact: lastContact || null });
  }, [lastContact, push]);

  // ── Dropdowns / text fields ─────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    push({
      assignedTo: assignedTo || null,
      createdAtGte: dateFrom || null,
      createdAtLte: dateTo || null,
      source: source || null,
      service: service || null,
      zone: zone || null,
    });
  }, [assignedTo, dateFrom, dateTo, source, service, zone, push]);

  // ── Handlers (setState only, no push) ───────────────────────────
  const toggleStage = useCallback((name: string) => {
    setVisibleStages((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleBotActiveToggle = useCallback(() => setIsBotActive((p) => !p), []);
  const handleHandoffToggle  = useCallback(() => setIsHandoff((p) => !p), []);

  // ── Styles ──────────────────────────────────────────────────────
  const toggleButtonClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
      active
        ? 'bg-brand-50 text-brand-700 border-brand-300'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
    }`;

  const inputClass =
    'text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  // ── Filter content (shared desktop + mobile) ────────────────────
  const filterContent = (
    <div className="flex flex-col gap-3">
      {/* Row 1: Quick filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} w-48`}
        />

        <div className="flex items-center gap-2">
          <label htmlFor="filter-assigned" className="text-xs text-gray-500">Asignado</label>
          <select
            id="filter-assigned"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="placeholder" disabled>Cargar usuarios...</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Etapas</span>
          {stages.map((stage) => (
            <label key={stage.name} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
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

        <button onClick={handleBotActiveToggle} className={toggleButtonClass(isBotActive)}>Bot activo</button>
        <button onClick={handleHandoffToggle} className={toggleButtonClass(isHandoff)}>Handoff</button>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Score</label>
          <input type="number" placeholder="Min" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} className={`${inputClass} w-16`} />
          <span className="text-gray-300">-</span>
          <input type="number" placeholder="Max" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} className={`${inputClass} w-16`} />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-last-contact" className="text-xs text-gray-500">Último contacto</label>
          <select
            id="filter-last-contact"
            value={lastContact}
            onChange={(e) => setLastContact(e.target.value)}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="today">Hoy</option>
            <option value="week">Última semana</option>
            <option value="never">Sin contacto</option>
          </select>
        </div>
      </div>

      {/* Row 2: Segmentation */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-date-from" className="text-xs text-gray-500">Desde</label>
          <input id="filter-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-date-to" className="text-xs text-gray-500">Hasta</label>
          <input id="filter-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-source" className="text-xs text-gray-500">Origen</label>
          <select id="filter-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Llamada</option>
            <option value="form">Formulario</option>
            <option value="referral">Referido</option>
            <option value="walk_in">Presencial</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-service" className="text-xs text-gray-500">Servicio</label>
          <select id="filter-service" value={service} onChange={(e) => setService(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            <option value="repair">Reparación</option>
            <option value="installation">Instalación</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="budget">Presupuesto</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-zone" className="text-xs text-gray-500">Zona</label>
          <input id="filter-zone" type="text" placeholder="Zona" value={zone} onChange={(e) => setZone(e.target.value)} className={`${inputClass} w-28`} />
        </div>
      </div>

      {/* Row 3: Actions + Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onNewLead} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            + Nuevo lead
          </button>
          <button onClick={onExport} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Exportar
          </button>
          <button onClick={onBulkAssign} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Asignación masiva
          </button>
          <button onClick={onViewActivity} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Ver actividad
          </button>
        </div>

        {metrics && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {metrics.total}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-xs font-medium text-red-600">
              🔥 {metrics.calientes}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-xs font-medium text-amber-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {metrics.handoffs}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
              {metrics.sinRespuesta} sin respuesta
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden sm:block px-4 py-3 border-b border-gray-200 bg-white">
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
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>
              <button onClick={() => setMobileOpen(false)} className="text-sm text-brand-600 font-medium">
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
