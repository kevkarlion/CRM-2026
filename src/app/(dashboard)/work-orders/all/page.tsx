'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { useRole } from '@/dashboard/context/role-context';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { formatDateShort as formatDate } from '@/operations/helpers/date-utils';
import { Loader2, ArrowLeft } from 'lucide-react';
import { WORK_ORDER_STATUS_LABELS } from '@/operations/constants/status-labels';
import { SearchInput } from '@/components/ui/SearchInput';

// Helper to get short WO number (last 7 chars)
function shortWO(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

function isTechAssigned(wo: WorkOrder, currentUserName: string | null, currentUserEmail: string | null): boolean {
  if (!currentUserName && !currentUserEmail) return false;
  return (wo.assignedTechnicians ?? []).some((t) => {
    if (typeof t === 'string') return false;
    if (currentUserEmail && t.email) {
      return t.email.toLowerCase() === currentUserEmail.toLowerCase();
    }
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
  workStatus?: string;
  scheduledDate?: string;
  createdAt?: string;
  clientSnapshot?: { name?: string };
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string } | string>;
}

interface ListResponse {
  data: WorkOrder[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const CANONICAL_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled_only', label: 'Programada' },
  { value: 'assigned_only', label: 'Asignada' },
  { value: 'scheduled_assigned', label: 'Prog. y Asignadas' },
  { value: 'in_progress', label: 'En Ejecución' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Completada' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'active', label: 'Negocio Activo' },
  { value: 'paused_negocio', label: 'Negocio Pausado' },
  { value: 'cancelled_negocio', label: 'Negocio Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const STATUS_VARIANT: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  assigned: 'bg-purple-50 text-purple-700',
  in_progress: 'bg-amber-50 text-amber-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  closed: 'bg-slate-50 text-slate-700',
  draft: 'bg-gray-50 text-gray-600',
  cancelled: 'bg-red-50 text-red-700',
};

const PRIORITY_VARIANT: Record<string, string> = {
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

const STATUS_VARIANT_MOBILE: Record<string, string> = {
  scheduled: 'bg-sky-600 text-white',
  confirmed: 'bg-sky-600 text-white',
  assigned: 'bg-sky-600 text-white',
  in_progress: 'bg-amber-500 text-gray-900',
  paused: 'bg-amber-500 text-gray-900',
  completed: 'bg-emerald-700 text-white',
  closed: 'bg-gray-700 text-white',
  draft: 'bg-gray-200 text-gray-800',
  cancelled: 'bg-rose-600 text-white',
};

const PRIORITY_VARIANT_MOBILE: Record<string, string> = {
  normal: 'bg-gray-200 text-gray-800',
  high: 'bg-amber-500 text-gray-900',
  urgent: 'bg-rose-600 text-white',
};

const PRIORITY_ACCENT_MOBILE: Record<string, string> = {
  normal: 'border-l-sky-500',
  high: 'border-l-amber-500',
  urgent: 'border-l-rose-500',
};

function label<T extends { value: string; label: string }>(opts: T[], val: string): string {
  return opts.find(o => o.value === val)?.label ?? val;
}

function AllWorkOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isTechnician, user, loading: roleLoading } = useRole();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [technicians, setTechnicians] = useState<{ _id: string; name: string }[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortField, setSortField] = useState<'scheduledDate' | 'createdAt' | 'workOrderNumber'>('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string } | null>(null);
  const [workStatusDropdown, setWorkStatusDropdown] = useState<string | null>(null);
  const [changingWorkStatus, setChangingWorkStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    try {
      console.log('[WorkOrdersAll] fetchOrders starting');
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (search) params.search = search;
      
      if (statusFilter === 'expired') {
        params.expired = 'true';
      } else if (statusFilter === 'paused_negocio') {
        params.workStatus = 'paused';
      } else if (statusFilter === 'cancelled_negocio') {
        params.workStatus = 'cancelled';
      } else if (statusFilter === 'active') {
        params.workStatus = 'active';
      } else if (statusFilter === 'scheduled_assigned') {
        params.hasScheduledDate = 'true';
        params.hasTechnician = 'true';
      } else if (statusFilter === 'scheduled_only') {
        params.status = 'scheduled';
      } else if (statusFilter === 'assigned_only') {
        params.status = 'in_progress';
        params.scheduledDate = 'none';
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      if (priorityFilter) params.priority = priorityFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (technicianFilter) params.technicianId = technicianFilter;
      
      params.page = String(page);
      params.limit = String(limit);

      const endpoint = '/api/operations/work-orders';

      const result = await api.get<ListResponse>(endpoint, params);
      console.log('[WorkOrdersAll] fetchOrders got result:', (result as any).total);
      setOrders(unwrapData(result));
      setTotal((result as any).total);
    } catch (err) {
      console.error('[WorkOrdersAll] fetchOrders error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar órdenes');
    } finally {
      console.log('[WorkOrdersAll] fetchOrders finished');
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, fromDate, toDate, technicianFilter, page]);

  // Track if auto-filters from URL have been applied (to avoid infinite loops)
  const autoFiltersApplied = useRef(false);

  // Initial load - loads technicians and fetches orders
  useEffect(() => {
    console.log('[WorkOrdersAll] Initial effect running');
    if (!mountedRef.current) {
      console.log('[WorkOrdersAll] First mount - loading techs and fetching');
      mountedRef.current = true;
      loadTechnicians();
      fetchOrders();
    }
  }, []);

  // When filters or search change, re-fetch
  useEffect(() => {
    console.log('[WorkOrdersAll] Filter effect:', { techniciansLength: technicians.length, roleLoading, mounted: mountedRef.current });
    if (technicians.length === 0) return;
    if (roleLoading) return;
    if (!mountedRef.current) return;
    
    fetchOrders();
  }, [search, statusFilter, technicianFilter, priorityFilter, fromDate, toDate, page]);

  // Auto-select filters from URL - runs AFTER technicians are loaded
  useEffect(() => {
    if (roleLoading) return;
    if (technicians.length === 0) return;
    if (autoFiltersApplied.current) return;
    
    const urlExpired = new URLSearchParams(window.location.search).get('expired');
    const urlTechId = new URLSearchParams(window.location.search).get('technicianId');
    
    // If no URL params, nothing to do
    if (urlExpired !== 'true' && !urlTechId) return;
    
    console.log('[WorkOrdersAll] Applying URL filters:', { urlExpired, urlTechId });
    autoFiltersApplied.current = true;
    
    // Apply technician filter
    if (urlTechId) {
      setTechnicianFilter(urlTechId);
    } else if (isTechnician && user?.email) {
      // Auto-select self for technicians
      const userEmailLower = user.email.toLowerCase();
      const myTech = technicians.find(t => 
        t.email?.toLowerCase() === userEmailLower ||
        t.email?.toLowerCase().includes(userEmailLower.split('@')[0])
      );
      if (myTech) {
        console.log('[WorkOrdersAll] Auto-selected technician:', myTech.name);
        setTechnicianFilter(myTech._id);
      }
    }
    
    // Apply expired filter
    if (urlExpired === 'true') {
      setStatusFilter('expired');
    }
    
    // fetchOrders will be triggered automatically by filter effect
  }, [roleLoading, technicians.length, isTechnician, user?.email]);

  async function loadTechnicians() {
    try {
      const data = await api.get<{ data: { _id: string; name: string; email?: string }[] }>('/api/operations/technicians');
      const techs = data.data || [];
      setTechnicians(techs);
    } catch (err) {
      // ignore
    }
  }

  const clientName = (wo: WorkOrder) => wo.clientSnapshot?.name || '—';
  const technicianName = (wo: WorkOrder) => {
    const techs = wo.assignedTechnicians;
    if (!techs || techs.length === 0) return '—';
    return techs.map(t => typeof t === 'string' ? t : t.name).join(', ');
  };

  // Client-side sort - instant, no re-fetch
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === 'createdAt') {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortField === 'scheduledDate') {
        aVal = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        bVal = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      } else {
        aVal = a.workOrderNumber || '';
        bVal = b.workOrderNumber || '';
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortField, sortDir]);

  const isOverdue = (wo: WorkOrder) => {
    if (!wo.scheduledDate || wo.status === 'closed' || wo.status === 'completed' || wo.status === 'cancelled') return false;
    const now = new Date();
    const scheduled = new Date(wo.scheduledDate);
    return scheduled < now;
  };

  function SortIcon({ field }: { field: 'scheduledDate' | 'createdAt' | 'workOrderNumber' }) {
    const isActive = sortField === field;
    return (
      <span className={`ml-1 ${isActive ? 'text-brand-600' : 'text-gray-300'}`}>
        {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↑'}
      </span>
    );
  }

  const handleSort = (field: 'scheduledDate' | 'createdAt' | 'workOrderNumber') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Todas las Órdenes</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total > 0 ? `${total} órdenes encontradas` : 'Gestiona todas las órdenes de trabajo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/work-orders/informes"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Informes Técnicos
          </a>
          {!isTechnician && (
            <button
              onClick={() => router.push('/work-orders/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva OT
            </button>
          )}
        </div>
      </div>

      {/* Filters - always show all filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Búsqueda:</label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por título o cliente..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Técnico:</label>
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter((e.target as any).value)}
            className="w-full relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            <option value="">Todos los técnicos</option>
            {technicians.map((tech) => (
              <option key={tech._id} value={tech._id}>{tech.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target as any).value)}
            className="w-full relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            {CANONICAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Prioridad:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter((e.target as any).value)}
            className="w-full relative z-10 rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Fecha:</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate((e.target as any).value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate((e.target as any).value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin órdenes de trabajo</h3>
          <p className="text-sm text-gray-500">No hay órdenes que coincidan con tu búsqueda</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="min-w-[120px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Negocio</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600" onClick={() => handleSort('createdAt')}>Creación <SortIcon field="createdAt" /></th>
                  <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600" onClick={() => handleSort('scheduledDate')}>Fecha <SortIcon field="scheduledDate" /></th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Técnico</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((wo, idx) => {
                  const isOwn = isTechAssigned(wo, isTechnician ? user.name : null, isTechnician ? user.email : null);
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  return (
                    <tr key={wo._id} className={`${rowBg} border-b border-gray-100 hover:bg-brand-50/40 transition-colors`}>
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          onClick={() => router.push(`/work-orders/${wo._id}`)}
                          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
                        >
                          Ver
                        </button>
                      </td>
                      <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">#{shortWO(wo.workOrderNumber)}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">{wo.title}</td>
                      <td className="px-2 py-1.5 text-gray-700 align-middle">{clientName(wo)}</td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                            {label(STATUS_OPTIONS, wo.status)}
                          </span>
                          {isOverdue(wo) && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                              VENCIDA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${
                          wo.workStatus === 'active' ? 'bg-green-100 text-green-800' :
                          wo.workStatus === 'paused' ? 'bg-amber-100 text-amber-800' :
                          wo.workStatus === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {wo.workStatus === 'active' ? 'Activa' :
                           wo.workStatus === 'paused' ? 'Pausada' :
                           wo.workStatus === 'completed' ? 'Completada' :
                           'Activa'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {label(PRIORITY_OPTIONS, wo.priority)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 align-middle">{formatDate(wo.createdAt)}</td>
                      <td className="px-2 py-1.5 text-gray-600 align-middle">{formatDate(wo.scheduledDate)}</td>
                      <td className="px-2 py-1.5 text-gray-600 align-middle">{technicianName(wo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {sortedOrders.map((wo) => (
              <div key={wo._id} className={`bg-white border border-gray-200 border-l-4 rounded-xl p-4 shadow-sm space-y-3 ${PRIORITY_ACCENT_MOBILE[wo.priority] || 'border-l-sky-500'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">#{shortWO(wo.workOrderNumber)}</span>
                    {isTechAssigned(wo, isTechnician ? user.name : null, isTechnician ? user.email : null) && (
                      <span className="text-yellow-500 text-sm" title="Asignada a ti">★</span>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT_MOBILE[wo.status] || 'bg-gray-200 text-gray-800'}`}>
                    {label(STATUS_OPTIONS, wo.status)}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{wo.title}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cliente</span>
                    <span className="text-sm text-gray-900">{clientName(wo)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Prioridad</span>
                    <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT_MOBILE[wo.priority] || 'bg-gray-200 text-gray-800'}`}>
                      {label(PRIORITY_OPTIONS, wo.priority)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Programado</span>
                    <span className="text-sm text-gray-900">{formatDate(wo.scheduledDate)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Técnico</span>
                    <span className="text-sm text-gray-900">{technicianName(wo)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/work-orders/${wo._id}`)}
                    className="inline-flex items-center justify-center gap-1.5 w-full text-center rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors cursor-pointer"
                  >
                    Ver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Separate component to be wrapped in Suspense
function WorkOrdersAllContent() {
  return <AllWorkOrdersPage />;
}

export default function WorkOrdersAllPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <WorkOrdersAllContent />
    </Suspense>
  );
}
