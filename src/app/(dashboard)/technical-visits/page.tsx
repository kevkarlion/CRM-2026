'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface WorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
  assignedTechnicians?: Array<{ _id: string; name: string } | string>;
  leadId?: string;
}

interface ListResponse {
  data: WorkOrder[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'assigned', label: 'Asignado' },
  { value: 'en_route', label: 'En Ruta' },
  { value: 'on_site', label: 'En Sitio' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  en_route: 'bg-amber-50 text-amber-700',
  on_site: 'bg-orange-50 text-orange-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  closed: 'bg-slate-50 text-slate-700',
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
  emergency: 'bg-red-100 text-red-900',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function clientName(wo: WorkOrder): string {
  return wo.clientSnapshot?.name || '—';
}

function technicianName(wo: WorkOrder): string {
  if (!wo.assignedTechnicians?.length) return '—';
  const t = wo.assignedTechnicians[0];
  return typeof t === 'object' ? t.name : t;
}

export default function TechnicalVisitsPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Always filter for technical visits only
      const params: Record<string, string> = { type: 'technical_visit' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const result = await api.get<ListResponse>('/api/operations/work-orders', params);
      setOrders(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar visitas');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, fromDate, toDate]);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, priorityFilter, fromDate, toDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function handleRowClick(id: string) {
    router.push(`/work-orders/${id}`);
  }

  function handleNew() {
    router.push('/work-orders/new?source=technical_visit');
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
          value={priorityFilter}
          onChange={(e) => setPriorityFilter((e.target as any).value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          {PRIORITY_OPTIONS.map((opt) => (
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
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-medium text-gray-900">No hay visitas técnicas</h3>
          <p className="text-gray-500 mt-1">Programá una nueva visita técnica para un lead</p>
        </div>
      ) : (
        <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Título</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Programado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Técnico</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((wo) => (
                <tr
                  key={wo._id}
                  onClick={() => handleRowClick(wo._id)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{wo.workOrderNumber}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{wo.title}</td>
                  <td className="px-5 py-3 text-gray-700">{clientName(wo)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                      {label(STATUS_OPTIONS, wo.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {label(PRIORITY_OPTIONS, wo.priority)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(wo.scheduledDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{technicianName(wo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {orders.map((wo) => (
          <div
            key={wo._id}
            onClick={() => handleRowClick(wo._id)}
            className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-gray-900">{wo.workOrderNumber}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                {label(PRIORITY_OPTIONS, wo.priority)}
              </span>
            </div>
            <div className="text-sm text-gray-700 font-medium">{wo.title}</div>
            <div className="text-sm text-gray-500 mt-1">{clientName(wo)}</div>
            <div className="flex justify-between items-center mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                {label(STATUS_OPTIONS, wo.status)}
              </span>
              <span className="text-xs text-gray-500">{formatDate(wo.scheduledDate)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}