'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { useRole } from '@/dashboard/context/role-context';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { formatDateShort as formatDate } from '@/operations/helpers/date-utils';
import { Loader2, ArrowLeft } from 'lucide-react';
import { WORK_ORDER_STATUS_LABELS } from '@/operations/constants/status-labels';
import { SearchInput } from '@/components/ui/SearchInput';

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

// Canonical statuses only for filtering
// status = operativo (flujo del técnico)
// workStatus = negocio (control de vencidas)
const CANONICAL_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled_only', label: 'Programada' }, // Solo programadas sin técnico
  { value: 'assigned_only', label: 'Asignada' }, // Solo asignadas sin fecha
  { value: 'scheduled_assigned', label: 'Programada + Asignada' }, // Tiene ambas
  { value: 'in_progress', label: 'En Ejecucion' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'paused', label: 'Pausada (operativo)' },
  { value: 'paused_negocio', label: 'Pausada (negocio)' },
  { value: 'cancelled_negocio', label: 'Cancelada (negocio)' },
  { value: 'active', label: 'Activa (negocio)' },
  { value: 'expired', label: 'Vencidas' },
];

// Status label helper - groups multiple internal statuses into simplified view
function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
    case 'confirmed':
    case 'assigned':
      return 'Programada';
    case 'paused':
      return 'Pausada';
    case 'cancelled':
      return 'Cancelada';
    case 'closed':
      return 'Cerrada';
    default:
      return WORK_ORDER_STATUS_LABELS[status as keyof typeof WORK_ORDER_STATUS_LABELS] || status;
  }
}

// Simplified status badges for the table
const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-blue-50 text-blue-700',
  assigned: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  closed: 'bg-slate-50 text-slate-700',
};

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const PRIORITY_VARIANT: Record<string, string> = {
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

// Check if work order is overdue (past scheduled date and not completed/closed/paused)
function isOverdue(wo: WorkOrder): boolean {
  if (!wo.scheduledDate) return false;
  // No es vencida si: completed, closed, cancelled, o si workStatus es paused/cancelled
  if (['completed', 'closed', 'cancelled'].includes(wo.status)) return false;
  if ((wo as any).workStatus === 'paused' || (wo as any).workStatus === 'cancelled' || (wo as any).workStatus === 'completed') return false;
  
  // Parse date
  const dateStr = String(wo.scheduledDate);
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  // Calcular "hoy" en timezone Argentina (UTC-3)
  const now = new Date();
  const argentinaOffset = -3 * 60;
  const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + argentinaOffset) * 60000);
  localNow.setHours(0, 0, 0, 0);
  
  const scheduled = new Date(year, month - 1, day);
  scheduled.setHours(0, 0, 0, 0);
  
  return scheduled < localNow;
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
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <span className="ml-2 text-gray-500">Cargando...</span>
      </div>
    }>
      <WorkOrdersContent />
    </Suspense>
  );
}

function WorkOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isTechnician, user, loading: roleLoading } = useRole();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to 'all' - show all technicians' scheduled orders
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // Show loading while role is being determined
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('expired') === 'true' ? 'expired' : (searchParams.get('status') || 'not_closed')
  );
  const [priorityFilter, setPriorityFilter] = useState('');
  const [fromDate, setFromDate] = useState(searchParams.get('startDate') || new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(searchParams.get('endDate') || '');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [technicians, setTechnicians] = useState<{ _id: string; name: string }[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortField, setSortField] = useState<'scheduledDate' | 'createdAt' | 'workOrderNumber'>('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Self-assignment drawer state
  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string } | null>(null);

  // WorkStatus dropdown state (negocio)
  const [workStatusDropdown, setWorkStatusDropdown] = useState<string | null>(null);
  const [changingWorkStatus, setChangingWorkStatus] = useState<string | null>(null);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, fromDate, toDate, technicianFilter, search, workStatusDropdown]);

  // Cerrar dropdowns al hacer click fuera
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workStatusDropdown && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWorkStatusDropdown(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [workStatusDropdown]);

  // Cambiar workStatus desde la lista (solo actualiza esa fila, no recarga toda la tabla)
  const handleWorkStatusChange = async (woId: string, newWorkStatus: string, version: number) => {
    setChangingWorkStatus(woId);
    try {
      await api.patch(`/api/operations/work-orders/${woId}`, {
        workStatus: newWorkStatus,
        version: version,
      });
      // Actualizar solo la fila affected
      setOrders(prev => prev.map(wo => 
        wo._id === woId ? { ...wo, workStatus: newWorkStatus, version: version + 1 } : wo
      ));
      setWorkStatusDropdown(null);
    } catch (err) {
      console.error('Error changing workStatus:', err);
    } finally {
      setChangingWorkStatus(null);
    }
  };

  const mountedRef = useRef(false);

const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (search) params.search = search;
      
      // Handle special filters
      if (statusFilter === 'expired') {
        params.expired = 'true';
      } else if (statusFilter === 'paused_negocio') {
        // Filter by workStatus === 'paused' (negocio)
        params.workStatus = 'paused';
      } else if (statusFilter === 'cancelled_negocio') {
        // Filter by workStatus === 'cancelled' (negocio)
        params.workStatus = 'cancelled';
      } else if (statusFilter === 'active') {
        // Filter by workStatus === 'active' (negocio)
        params.workStatus = 'active';
} else if (statusFilter === 'scheduled_assigned') {
        // Programada + Asignada (tiene scheduledDate Y técnico asignado)
        // No filtramos por status, solo por los campos
        params.hasScheduledDate = 'true';
        params.hasTechnician = 'true';
      } else if (statusFilter === 'scheduled_only') {
        // Solo programadas (scheduled)
        params.status = 'scheduled';
      } else if (statusFilter === 'assigned_only') {
        // Solo asignadas (in_progress sin scheduledDate)
        params.status = 'in_progress';
        params.scheduledDate = 'none';
      } else if (statusFilter === 'not_closed') {
        // Excluir closed y cancelled
        params.status = 'not_closed';
      } else if (statusFilter) {
        // Regular status filter (operativo)
        params.status = statusFilter;
      }
      if (priorityFilter) params.priority = priorityFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (technicianFilter) params.technicianId = technicianFilter;
      
      // Pagination
      params.page = String(page);
      params.limit = String(limit);

      // Use different endpoint based on tab
      const endpoint = activeTab === 'mine'
        ? '/api/operations/work-orders/my-orders'
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
    // Don't fetch while role is loading
    if (roleLoading) return;
    
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
  }, [search, statusFilter, priorityFilter, fromDate, toDate, technicianFilter, activeTab, page, roleLoading, isTechnician]);

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isTechnician ? (activeTab === 'mine' ? 'Mis Órdenes' : 'Todas las Órdenes') : 'Órdenes de Trabajo'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total > 0 ? `${total} órdenes encontradas` : 'Gestiona tus órdenes de trabajo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/work-orders/informes"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Informes Técnicos
          </a>
          {!isTechnician && (
            <button
              onClick={handleNew}
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

      {/* No filters - just show the orders list */}

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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="min-w-[120px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-1.5"><div className="h-5 w-10 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-5 w-14 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-2 py-1.5"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
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
          {!isTechnician && (
            <button onClick={handleNew} className="text-sm text-brand-600 font-medium hover:text-brand-700">
              Crear primera OT
            </button>
          )}
        </div>
      ) : (
        <>
<div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
<tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="min-w-[120px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Titulo</th>
                  <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Negocio</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600" onClick={() => handleSort('createdAt')}>Creacion <SortIcon field="createdAt" /></th>
                  <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600" onClick={() => handleSort('scheduledDate')}>Fecha <SortIcon field="scheduledDate" /></th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tecnico</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((wo, idx) => {
                  const isOwn = isTechAssigned(wo, isTechnician ? user.name : null, isTechnician ? user.email : null);
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  return (
                    <tr
                      key={wo._id}
                      className={`${rowBg} border-b border-gray-100 hover:bg-brand-50/40 transition-colors`}
                    >
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/work-orders/${wo._id}`);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
                        >
                          Ver
                        </button>
                        {isTechnician && !isAdmin && !isOwn && activeTab === 'all' && 
                         (wo.status === 'scheduled' || wo.status === 'draft') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelfAssignWO({ id: wo._id, number: wo.workOrderNumber });
                              setSelfAssignOpen(true);
                            }}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 ml-2"
                          >
                            Solicitar
                          </button>
                        )}
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
                      {/* Columna de estado de negocio (workStatus) */}
                      <td className="px-2 py-1.5 align-middle">
                        {(() => {
                          // Si el status operativo es 'closed', mostrar como completed aunque workStatus sea 'active'
                          const effectiveWorkStatus = wo.status === 'closed' ? 'completed' : (wo.workStatus || 'active');
                          const canChange = !['closed', 'cancelled', 'in_progress'].includes(wo.status) && effectiveWorkStatus !== 'completed';
                          
                          if (changingWorkStatus === wo._id) {
                            return <span className="text-xs text-gray-400">Cambiando...</span>;
                          }
                          
                          return (
                            <div className="relative" ref={dropdownRef}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canChange) {
                                    setWorkStatusDropdown(workStatusDropdown === wo._id ? null : wo._id);
                                  }
                                }}
                                className={`inline-flex items-center justify-between px-2 py-0.5 rounded-md text-xs font-medium w-20 ${
                                  canChange ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'
                                } ${
                                  effectiveWorkStatus === 'active' ? 'bg-green-100 text-green-800' :
                                  effectiveWorkStatus === 'paused' ? 'bg-amber-100 text-amber-800' :
                                  effectiveWorkStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  effectiveWorkStatus === 'completed' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-700'
                                }`}
                              >
                                <span className="truncate">
                                  {effectiveWorkStatus === 'active' ? 'Activa' : 
                                   effectiveWorkStatus === 'paused' ? 'Pausada' : 
                                   effectiveWorkStatus === 'cancelled' ? 'Cancelada' : 
                                   effectiveWorkStatus === 'completed' ? 'Completada' : 
                                   effectiveWorkStatus}
                                </span>
                                {canChange && (
                                  <svg className="w-3 h-3 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </button>
                              
                              {/* Dropdown menu - solo muestra opciones distintas al actual */}
                              {workStatusDropdown === wo._id && canChange && (() => {
                                const currentWs = effectiveWorkStatus;
                                const options = [];
                                if (currentWs !== 'active') options.push({ value: 'active', label: 'Activa', color: 'green' });
                                if (currentWs !== 'paused') options.push({ value: 'paused', label: 'Pausar', color: 'amber' });
                                if (currentWs !== 'cancelled') options.push({ value: 'cancelled', label: 'Cancelada', color: 'red' });
                                
                                return options.length > 0 ? (
                                  <div className="absolute z-10 mt-1 w-28 bg-white border border-gray-200 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
                                    {options.map(opt => (
                                      <button
                                        key={opt.value}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleWorkStatusChange(wo._id, opt.value, wo.version);
                                        }}
                                        className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-${opt.color}-100 cursor-pointer transition-colors text-${opt.color}-700`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {label(PRIORITY_OPTIONS, wo.priority)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap align-middle">{formatDate(wo.createdAt)}</td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap align-middle">{formatDate(wo.scheduledDate)}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate align-middle">{technicianName(wo)}</td>
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
                      className="inline-flex items-center justify-center gap-1.5 flex-1 text-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver
                    </button>
                    {/* Botón "Solicitar" para técnicos - en OTs Programadas (sin técnico) o Borrador */}
                    {isTechnician && !isAdmin && !isOwn && activeTab === 'all' && 
                     (wo.status === 'scheduled' || wo.status === 'draft') && (
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
          
          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
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
