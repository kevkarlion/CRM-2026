'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface TechnicalVisit {
  _id: string;
  visitNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
  locationSnapshot?: { address?: string };
  assignedTechnicianId?: { _id: string; name: string; email?: string } | string | null;
}

interface ListResponse {
  data: TechnicalVisit[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'converted_to_work_order', label: 'Convertido a OT' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'budget', label: 'Presupuesto' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'emergency', label: 'Emergencia' },
  { value: 'other', label: 'Otra' },
];

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  converted_to_work_order: 'bg-purple-50 text-purple-700',
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

const CATEGORY_VARIANT: Record<string, string> = {
  budget: 'bg-yellow-50 text-yellow-700',
  inspection: 'bg-blue-50 text-blue-700',
  assessment: 'bg-indigo-50 text-indigo-700',
  emergency: 'bg-red-50 text-red-700',
  other: 'bg-gray-50 text-gray-700',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function clientName(visit: TechnicalVisit): string {
  return visit.clientSnapshot?.name || '—';
}

function technicianName(visit: TechnicalVisit): string {
  if (!visit.assignedTechnicianId) return '—';
  const t = visit.assignedTechnicianId;
  return typeof t === 'object' ? t.name : '—';
}

export default function TechnicalVisitsPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<TechnicalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [total, setTotal] = useState(0);

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const result = await api.get<ListResponse>('/api/operations/technical-visits', params);
      setVisits(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar visitas');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter, fromDate, toDate]);

  useEffect(() => {
    fetchVisits();
  }, [statusFilter, priorityFilter, categoryFilter, fromDate, toDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVisits();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function handleRowClick(id: string) {
    router.push(`/technical-visits/${id}`);
  }

  function handleNew() {
    router.push('/technical-visits/new');
  }

  const label = (opts: { value: string; label: string }[], val: string) =>
    opts.find((o) => o.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Visitas Técnicas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} visitas técnicas` : 'Inspecciones y presupuestos in-situ'}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Visita Técnica
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as any).value)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as any).value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter((e.target as any).value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate((e.target as any).value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            title="Desde"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate((e.target as any).value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            title="Hasta"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-medium text-gray-900">No hay visitas técnicas</h3>
          <p className="text-gray-500 mt-1">Programá una nueva visita técnica</p>
        </div>
      ) : (
        <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Título</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Categoría</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Programado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Técnico</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr
                  key={visit._id}
                  onClick={() => handleRowClick(visit._id)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{visit.visitNumber}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{visit.title}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_VARIANT[visit.category] || 'bg-gray-100 text-gray-700'}`}>
                      {label(CATEGORY_OPTIONS, visit.category)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                      {label(STATUS_OPTIONS, visit.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {label(PRIORITY_OPTIONS, visit.priority)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(visit.scheduledDate)}</td>
                  <td className="px-5 py-3 text-gray-700">{technicianName(visit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {visits.map((visit) => (
          <div
            key={visit._id}
            onClick={() => handleRowClick(visit._id)}
            className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">{visit.visitNumber}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                {label(PRIORITY_OPTIONS, visit.priority)}
              </span>
            </div>
            <div className="text-sm text-gray-700 font-medium">{visit.title}</div>
            <div className="flex gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_VARIANT[visit.category] || 'bg-gray-100 text-gray-700'}`}>
                {label(CATEGORY_OPTIONS, visit.category)}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                {label(STATUS_OPTIONS, visit.status)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2">{formatDate(visit.scheduledDate)}</div>
            {visit.assignedTechnicianId && (
              <div className="text-xs text-gray-600 mt-1">Técnico: {technicianName(visit)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}