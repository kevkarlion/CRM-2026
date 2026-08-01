'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { useRole } from '@/dashboard/context/role-context';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { formatDateShort as formatDate } from '@/operations/helpers/date-utils';

type Tab = 'all' | 'mine';

// Helper to get short WO number (last 7 chars)
function shortWO(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

function isTechAssigned(wo: WorkOrder, currentUserName: string | null, currentUserEmail: string | null): boolean {
  if (!currentUserName && !currentUserEmail) return false;
  return (wo.assignedTechnicians ?? []).some((t) => {
    if (typeof t === 'string') return false;
    // Use email as primary identifier (unique)
    if (currentUserEmail && t.email) {
      return t.email.toLowerCase() === currentUserEmail.toLowerCase();
    }
    // Fallback: name comparison
    if (currentUserName && t.name) {
      return t.name.toLowerCase() === currentUserName.toLowerCase();
    }
    return false;
  });
}

interface WorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string } | string>;
}

interface ListResponse {
  data: WorkOrder[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

// Status label helper - groups multiple internal statuses into simplified view
function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft': return 'Borrador';
    case 'scheduled':
    case 'confirmed':
    case 'assigned':
      return 'Programada';
    case 'in_progress':
      return 'En Progreso';
    case 'completed':
      return 'Completada';
    case 'cancelled':
    case 'closed':
      return 'Cancelada';
    default:
      return status;
  }
}

// Simplified status badges for the table
const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-blue-50 text-blue-700',
  assigned: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
};

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'emergency', label: 'Emergencia' },
];

const PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
  emergency: 'bg-red-100 text-red-900',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
  emergency: 'Emergencia',
};

// Check if work order is overdue (past scheduled date and not completed/closed)
function isOverdue(wo: WorkOrder): boolean {
  if (!wo.scheduledDate) return false;
  if (['completed', 'closed', 'cancelled'].includes(wo.status)) return false;
  
  const scheduled = new Date(wo.scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return scheduled < today;
}

function clientName(wo: WorkOrder): string {
  return wo.clientSnapshot?.name || '—';
}

function technicianName(wo: WorkOrder): string {
  if (!wo.assignedTechnicians?.length) return '—';
  const t = wo.assignedTechnicians[0];
  return typeof t === 'object' ? t.name : t;
}

function sourceBadge(_source: string): { label: string; variant: string } {
  return { label: 'OT', variant: 'bg-blue-100 text-blue-700' };
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const { isAdmin, isTechnician, user } = useRole();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [total, setTotal] = useState(0);
  const [technicians, setTechnicians] = useState<{ _id: string; name: string }[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortField, setSortField] = useState<'scheduledDate' | 'createdAt' | 'workOrderNumber'>('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Self-assignment drawer state
  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string } | null>(null);
  const mountedRef = useRef(false);

const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (technicianFilter) params.technicianId = technicianFilter;

      // Use different endpoint based on tab
      const endpoint = activeTab === 'mine' && isTechnician
        ? '/api/operations/work-orders/technician'
        : '/api/operations/work-orders';

      const result = await api.get<ListResponse>(endpoint, params);
      setOrders(unwrapData(result));
      setTotal((result as any).total);
    } catch (err) {
      setError(err instanceof Error ? err.message: 'Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, fromDate, toDate, technicianFilter, activeTab, isTechnician]);

  // Initial load + filter changes (debounced search)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchOrders();
      loadTechnicians();
      return;
    }
    const timer = setTimeout(() => {
      fetchOrders();
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter, priorityFilter, fromDate, toDate, technicianFilter, activeTab]);

  async function loadTechnicians() {
    try {
      const data = await api.get<{ data: { _id: string; name: string }[] }>('/api/operations/technicians');
      setTechnicians(data.data || []);
    } catch (err) {
      // ignore
    }
  }

  function handleRowClick(id: string) {
    router.push(`/work-orders/${id}`);
  }

  function handleNew() {
    router.push('/work-orders/new');
  }

  const label = (opts: { value: string; label: string }[], val: string) => {
    if (opts === STATUS_OPTIONS) return getStatusLabel(val);
    return opts.find((o) => o.value === val)?.label || val;
  };

  // Sort orders client-side
  const sortedOrders = [...orders].sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortField === 'scheduledDate') {
      aVal = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      bVal = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
    } else if (sortField === 'createdAt') {
      aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    } else {
      aVal = a.workOrderNumber || '';
      bVal = b.workOrderNumber || '';
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(field: 'scheduledDate' | 'createdAt' | 'workOrderNumber') {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: 'scheduledDate' | 'createdAt' | 'workOrderNumber' }) {
    const isActive = sortField === field;
    return (
      <span className={`ml-1 ${isActive ? 'text-brand-600' : 'text-gray-300'}`}>
        {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↑'}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} órdenes encontradas` : 'Gestiona tus órdenes de trabajo'}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva OT
        </button>
      </div>

      {/* Tabs - Only show for technicians */}
      {isTechnician && (
        <div className="bg-white border border-gray-200 rounded-xl p-1 inline-flex">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todas las OT
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'mine'
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            MIS OT ★
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as any).value)}
            placeholder="Buscar por título o cliente..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <select
          value={technicianFilter}
          onChange={(e) => setTechnicianFilter((e.target as any).value)}
          className="relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          <option value="">Todos los técnicos</option>
          {technicians.map((tech) => (
            <option key={tech._id} value={tech._id}>{tech.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as any).value)}
          className="relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter((e.target as any).value)}
          className="relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
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
        <div className="space-y-4">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
            </div>
            <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {/* Tabs skeleton */}
          <div className="h-10 w-56 bg-gray-200 rounded-xl animate-pulse" />

          {/* Filters skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {/* Desktop table skeleton */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
                  <th className="text-left px-5 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-5 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-6 w-12 bg-gray-200 rounded animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards skeleton */}
          <div className="sm:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="flex gap-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin órdenes de trabajo</h3>
          <p className="text-sm text-gray-500 mb-4">No hay órdenes que coincidan con tu búsqueda</p>
          <button onClick={handleNew} className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Crear primera OT
          </button>
        </div>
      ) : (
        <>
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Título</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 cursor-pointer hover:text-brand-600" onClick={() => handleSort('scheduledDate')}>Fecha ejecución <SortIcon field="scheduredDate" /></th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Técnico</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((wo, idx) => {
                  const isOwn = isTechAssigned(wo, isTechnician ? user.name : null, isTechnician ? user.email : null);
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-100';
                  return (
                    <tr
                      key={wo._id}
                      className={`${rowBg} border-b border-gray-100 last:border-0 hover:bg-gray-100 transition-colors`}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">#{shortWO(wo.workOrderNumber)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{wo.title}</td>
                      <td className="px-5 py-3 text-gray-700">{clientName(wo)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                            {label(STATUS_OPTIONS, wo.status)}
                          </span>
                          {isOverdue(wo) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                              VENCIDA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {label(PRIORITY_OPTIONS, wo.priority)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(wo.scheduledDate)}</td>
                      <td className="px-5 py-3 text-gray-500">{technicianName(wo)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/work-orders/${wo._id}`);
                          }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Ver
                        </button>
                        {/* Botón "Solicitar" para técnicos - en OTs Programadas (sin técnico) o Asignadas (a otro técnico) */}
                        {isTechnician && !isAdmin && !isOwn && activeTab === 'all' && 
                         (wo.status === 'scheduled' || wo.status === 'assigned') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelfAssignWO({ id: wo._id, number: wo.workOrderNumber });
                              setSelfAssignOpen(true);
                            }}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors ml-2"
                          >
                            Solicitar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

<div className="sm:hidden space-y-3">
            {orders.map((wo, idx) => {
              const isOwn = isTechAssigned(wo, isTechnician ? user.name : null, isTechnician ? user.email : null);
              return (
                <div
                  key={wo._id}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${sourceBadge(wo.source).variant}`}>
                        {sourceBadge(wo.source).label}
                      </span>
                      {isOwn && (
                        <span className="text-yellow-500 text-sm" title="Asignada a ti">★</span>
                      )}
                      <p className="font-medium text-gray-900">{wo.title}</p>
                    </div>
                    <div className="flex gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                        {label(STATUS_OPTIONS, wo.status)}
                      </span>
                      {isOverdue(wo) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                          VENCIDA
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="text-gray-700">{clientName(wo)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {label(PRIORITY_OPTIONS, wo.priority)}
                    </span>
                    <span>Programado: {formatDate(wo.scheduledDate)}</span>
                    <span>Técnico: {technicianName(wo)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/work-orders/${wo._id}`);
                      }}
                      className="flex-1 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg text-center transition-colors"
                    >
                      Ver
                    </button>
                    {/* Botón "Solicitar" para técnicos - en OTs Programadas (sin técnico) o Asignadas (a otro técnico) */}
                    {isTechnician && !isAdmin && !isOwn && activeTab === 'all' && 
                     (wo.status === 'scheduled' || wo.status === 'assigned') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelfAssignWO({ id: wo._id, number: wo.workOrderNumber });
                          setSelfAssignOpen(true);
                        }}
                        className="flex-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        Solicitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selfAssignWO && (
        <SelfAssignmentDrawer
          isOpen={selfAssignOpen}
          onClose={() => {
            setSelfAssignOpen(false);
            setSelfAssignWO(null);
          }}
          workOrderId={selfAssignWO.id}
          workOrderNumber={selfAssignWO.number}
          technicianName={user.name}
          onAssigned={(workOrderId, technicianName) => {
            // Update only the specific work order in local state - no full refetch
            setOrders(prev => prev.map(wo => 
              wo._id === workOrderId 
                ? { ...wo, assignedTechnicians: [{ name: technicianName }] }
                : wo
            ));
          }}
        />
      )}
    </div>
  );
}
