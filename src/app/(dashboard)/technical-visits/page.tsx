'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { useRole } from '@/dashboard/context/role-context';
import { SelfAssignmentVisitDrawer } from '@/operations/components/SelfAssignmentVisitDrawer';

type Tab = 'all' | 'mine';

// Helper to get short visit number (last 7 chars)
function shortVT(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

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
  { value: 'scheduled', label: 'Programada' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'converted_to_work_order', label: 'Convertida a OT' },
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
      return 'Cancelada';
    case 'converted_to_work_order':
      return 'Convertida a OT';
    default:
      return status;
  }
}

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
  confirmed: 'bg-blue-50 text-blue-700',
  assigned: 'bg-blue-50 text-blue-700',
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

// Check if visit is overdue (past scheduled date and not completed/cancelled)
function isOverdue(vt: TechnicalVisit): boolean {
  if (!vt.scheduledDate) return false;
  if (['completed', 'cancelled', 'converted_to_work_order'].includes(vt.status)) return false;
  
  const scheduled = new Date(vt.scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return scheduled < today;
}

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

// Check if visit is assigned to current technician session
function isVisitAssignedToMe(visit: TechnicalVisit, currentUserEmail: string | null, currentUserName: string | null): boolean {
  if (!currentUserEmail && !currentUserName) return false;
  if (!visit.assignedTechnicianId) return false;
  const t = visit.assignedTechnicianId;
  if (typeof t !== 'object') return false;
  if (currentUserEmail && t.email) {
    return t.email.toLowerCase() === currentUserEmail.toLowerCase();
  }
  if (currentUserName && t.name) {
    return t.name.toLowerCase() === currentUserName.toLowerCase();
  }
  return false;
}

export default function TechnicalVisitsPage() {
  const router = useRouter();
  const { isAdmin, isTechnician, user } = useRole();
  const [activeTab, setActiveTab] = useState<Tab>('all');
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
  const [technicians, setTechnicians] = useState<{ _id: string; name: string }[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortField, setSortField] = useState<'scheduledDate' | 'createdAt' | 'visitNumber'>('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const mountedRef = useRef<boolean>(false);
  
  // Self-assignment state for visits
  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignVisit, setSelfAssignVisit] = useState<{ id: string; number: string } | null>(null);

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
      if (technicianFilter) params.technicianId = technicianFilter;

      // Use different endpoint based on tab
      const endpoint = activeTab === 'mine' && isTechnician
        ? '/api/operations/technical-visits/technician'
        : '/api/operations/technical-visits';

      const result = await api.get<ListResponse>(endpoint, params);
      setVisits(unwrapData(result));
      setTotal((result as any).total);
    } catch (err) {
      setError(err instanceof Error ? err.message: 'Error al cargar visitas');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter, fromDate, toDate, technicianFilter, activeTab, isTechnician]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchVisits();
      loadTechnicians();
      return;
    }
    const timer = setTimeout(() => {
      fetchVisits();
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter, priorityFilter, categoryFilter, fromDate, toDate, technicianFilter, activeTab]);

  async function loadTechnicians() {
    try {
      const data = await api.get<{ data: { _id: string; name: string }[] }>('/api/operations/technicians');
      setTechnicians(data.data || []);
    } catch (err) {
      // ignore
    }
  }

  function handleRowClick(id: string) {
    router.push(`/technical-visits/${id}`);
  }

  function handleNew() {
    router.push('/technical-visits/new');
  }

  const label = (opts: { value: string; label: string }[], val: string) =>
    opts === STATUS_OPTIONS ? getStatusLabel(val) : opts.find((o) => o.value === val)?.label || val;

  // Sort visits client-side
  const sortedVisits = [...visits].sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortField === 'scheduledDate') {
      aVal = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      bVal = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
    } else if (sortField === 'createdAt') {
      aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    } else {
      aVal = a.visitNumber || '';
      bVal = b.visitNumber || '';
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(field: 'scheduledDate' | 'createdAt' | 'visitNumber') {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: 'scheduledDate' | 'createdAt' | 'visitNumber' }) {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 inline-block text-brand-600">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  }

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

      {/* Tabs - Only show for technicians */}
      {isTechnician && (
        <div className="bg-white border border-gray-200 rounded-xl p-1 inline-flex">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todas las Visitas
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'mine'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            MIS VISITAS ★
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
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          <option value="">Todos los técnicos</option>
          {technicians.map((tech) => (
            <option key={tech._id} value={tech._id}>{tech.name}</option>
          ))}
        </select>
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Título</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Categoría</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Técnico</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-5 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-5 py-3"><div className="h-6 w-12 bg-gray-200 rounded animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <th className="text-left px-5 py-3 font-semibold text-gray-600 cursor-pointer hover:text-brand-600" onClick={() => handleSort('scheduledDate')}>Fecha ejecución<SortIcon field="scheduledDate" /></th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Técnico</th>
              </tr>
            </thead>
            <tbody>
              {sortedVisits.map((visit) => {
                const isMyVisit = isTechnician && isVisitAssignedToMe(visit, user.email, user.name);
                return (
                <tr
                  key={visit._id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">#{shortVT(visit.visitNumber)}</span>
                      {isMyVisit && <span className="text-yellow-500" title="Asignada a ti">★</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{visit.title}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_VARIANT[visit.category] || 'bg-gray-100 text-gray-700'}`}>
                      {label(CATEGORY_OPTIONS, visit.category)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                        {label(STATUS_OPTIONS, visit.status)}
                      </span>
                      {isOverdue(visit) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                          VENCIDA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {label(PRIORITY_OPTIONS, visit.priority)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(visit.scheduledDate)}</td>
                  <td className="px-5 py-3 text-gray-700">{technicianName(visit)}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/technical-visits/${visit._id}`);
                      }}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ver
                    </button>
                    {/* Botón "Solicitar" para técnicos - en Visitas Programadas (sin técnico) o Asignadas (a otro técnico) */}
                    {isTechnician && !isAdmin && !isMyVisit && activeTab === 'all' && 
                     (visit.status === 'scheduled' || visit.status === 'assigned') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelfAssignVisit({ id: visit._id, number: visit.visitNumber });
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
      )}

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {visits.map((visit) => {
          const isMyVisit = isTechnician && isVisitAssignedToMe(visit, user.email, user.name);
          return (
          <div
            key={visit._id}
            onClick={() => handleRowClick(visit._id)}
            className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900">{visit.visitNumber}</span>
                {isMyVisit && <span className="text-yellow-500 text-sm" title="Asignada a ti">★</span>}
              </div>
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
              {isOverdue(visit) && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                  VENCIDA
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-2">{formatDate(visit.scheduledDate)}</div>
            {visit.assignedTechnicianId && (
              <div className="text-xs text-gray-600 mt-1">Técnico: {technicianName(visit)}</div>
            )}
          </div>
          );
        })}
      </div>

      {/* Self-assignment drawer for visits */}
      {selfAssignVisit && (
        <SelfAssignmentVisitDrawer
          isOpen={selfAssignOpen}
          onClose={() => {
            setSelfAssignOpen(false);
            setSelfAssignVisit(null);
          }}
          visitId={selfAssignVisit.id}
          visitNumber={selfAssignVisit.number}
          technicianName={user.name}
          onAssigned={(visitId, technicianName) => {
            // Update only the specific visit in local state - no full refetch
            setVisits(prev => prev.map(vt => 
              vt._id === visitId 
                ? { ...vt, assignedTechnicianId: { name: technicianName } }
                : vt
            ));
            setSelfAssignOpen(false);
            setSelfAssignVisit(null);
          }}
        />
      )}
    </div>
  );
}