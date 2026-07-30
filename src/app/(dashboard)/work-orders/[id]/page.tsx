'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { VisitReportForm } from '@/operations/components/VisitReportForm';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { formatDateLong as formatDate } from '@/operations/helpers/date-utils';
import { useRole } from '@/dashboard/context/role-context';

// Helper to get short WO number (last 7 chars)
function shortWO(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

interface WorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  description?: string;
  priority: string;
  category: string;
  status: string;
  source: string;
  clientSnapshot?: { name?: string; email?: string; phone?: string };
  locationSnapshot?: { name?: string; address?: string; city?: string; province?: string };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string } | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string } | string>;
  // Campos adicionales para el técnico
  technicianNotes?: {
    materials?: string;
    tools?: string;
    additionalNotes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItem {
  _id: string;
  description: string;
  completed: boolean;
}

interface VisitReport {
  _id: string;
  workOrderId: string;
  technicianId?: string;
  arrivalTime?: string;
  departureTime?: string;
  workPerformed?: string;
  observations?: string;
  recommendations?: string;
  materialsUsed?: string;
  materialsItems?: { item: string; quantity: number; unit: string }[];
  needsNextVisit?: boolean;
  internalComments?: string;
  attachments?: { filename: string; url: string; type: string; uploadedAt: string }[];
  version?: number;
}

const STATUS_OPTIONS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  assigned: 'Asignado',
  en_route: 'En Ruta',
  on_site: 'En Sitio',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
};

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  en_route: 'bg-purple-50 text-purple-700',
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

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente', emergency: 'Emergencia',
};

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: 'scheduled', label: 'Programar' }, { value: 'cancelled', label: 'Cancelar' }],
  scheduled: [{ value: 'confirmed', label: 'Confirmar' }, { value: 'cancelled', label: 'Cancelar' }],
  confirmed: [{ value: 'assigned', label: 'Asignar' }, { value: 'cancelled', label: 'Cancelar' }],
  assigned: [{ value: 'en_route', label: 'En Ruta' }, { value: 'cancelled', label: 'Cancelar' }],
  en_route: [{ value: 'on_site', label: 'En Sitio' }, { value: 'cancelled', label: 'Cancelar' }],
  on_site: [{ value: 'paused', label: 'Pausar' }, { value: 'completed', label: 'Completar' }, { value: 'cancelled', label: 'Cancelar' }],
  paused: [{ value: 'on_site', label: 'Reanudar' }, { value: 'cancelled', label: 'Cancelar' }],
  completed: [{ value: 'closed', label: 'Cerrar' }],
  cancelled: [],
  closed: [],
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function technicianName(wo: WorkOrder): string {
  if (!wo.assignedTechnicians?.length) return '—';
  const t = wo.assignedTechnicians[0];
  return typeof t === 'object' ? t.name : t;
}

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAdmin, isTechnician } = useRole();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tecnico' | 'cliente'>('tecnico');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignTechId, setAssignTechId] = useState('');
  const [showAssignInput, setShowAssignInput] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{ _id: string; name: string; email?: string; specialties?: string[] }>>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [addingCheckItem, setAddingCheckItem] = useState(false);
  const [report, setReport] = useState<VisitReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  // Self-assignment drawer
  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssigning, setSelfAssigning] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await api.get<{ data: WorkOrder }>(`/api/operations/work-orders/${id}`);
        setWorkOrder(unwrapData(result));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar orden');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!workOrder) return;
    loadChecklist();
    loadTechnicians(); // Always pre-load for assign/reassign
    if (workOrder.status === 'completed' || workOrder.status === 'closed') {
      loadReport();
    }
  }, [workOrder?._id]);

  async function loadTechnicians() {
    if (technicians.length > 0) return; // already loaded
    setLoadingTechnicians(true);
    try {
      const result = await api.get<{ data: Array<{ _id: string; name: string; email?: string; specialties?: string[] }> }>('/api/operations/technicians');
      setTechnicians(unwrapData(result) || []);
    } catch {
      // silently ignore
    } finally {
      setLoadingTechnicians(false);
    }
  }

  async function loadChecklist() {
    setLoadingChecklist(true);
    try {
      const result = await api.get<{ data: ChecklistItem[] }>(`/api/operations/work-orders/${id}/checklist`);
      const data = result?.data;
      // Handle different response formats
      const checklistData = Array.isArray(data) ? data :
                   Array.isArray(data?.data) ? data.data : [];
      setChecklist(checklistData);
    } catch {
      // silently ignore
    } finally {
      setLoadingChecklist(false);
    }
  }

  async function addCheckItem() {
    if (!newCheckItem.trim()) return;
    setAddingCheckItem(true);
    try {
      await api.post(`/api/operations/work-orders/${id}/checklist`, { description: newCheckItem.trim() });
      setNewCheckItem('');
      loadChecklist();
    } catch {
      setError('Error al agregar item');
    } finally {
      setAddingCheckItem(false);
    }
  }

  async function toggleCheckItem(item: ChecklistItem) {
    try {
      await api.put(`/api/operations/work-orders/${id}/checklist/${item._id}`, { completed: !item.completed });
      loadChecklist();
    } catch {
      setError('Error al actualizar item');
    }
  }

  async function loadReport() {
    setLoadingReport(true);
    try {
      const result = await api.get<{ data: VisitReport | null }>(`/api/operations/work-orders/${id}/report`);
      setReport(unwrapData(result));
    } catch {
      // silently ignore
    } finally {
      setLoadingReport(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/operations/work-orders/${id}`);
      router.push('/work-orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true);
    try {
      const result = await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${id}/status`, { status: newStatus });
      setWorkOrder(unwrapData(result));
      setShowStatusMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleAssign() {
    if (!assignTechId.trim()) return;
    setAssigning(true);
    try {
      const hasCurrentTech = workOrder?.assignedTechnicians && workOrder.assignedTechnicians.length > 0;
      if (hasCurrentTech) {
        // Reassign: replace current technician
        const oldTech = workOrder.assignedTechnicians![0];
        const oldTechId = typeof oldTech === 'string' ? oldTech : oldTech._id;
        await api.post(`/api/operations/work-orders/${id}/assign`, {
          action: 'reassign',
          oldTechnicianId: oldTechId,
          newTechnicianId: assignTechId.trim(),
        });
      } else {
        // First assignment
        await api.post(`/api/operations/work-orders/${id}/assign`, {
          action: 'assign',
          technicianId: assignTechId.trim(),
        });
      }
      setShowAssignInput(false);
      setAssignTechId('');
      const result = await api.get<{ data: WorkOrder }>(`/api/operations/work-orders/${id}`);
      setWorkOrder(unwrapData(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(technicianId: string) {
    setUnassigning(true);
    try {
      await api.post(`/api/operations/work-orders/${id}/assign`, { action: 'unassign', technicianId });
      const result = await api.get<{ data: WorkOrder }>(`/api/operations/work-orders/${id}`);
      setWorkOrder(unwrapData(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desasignar');
    } finally {
      setUnassigning(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !workOrder) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Orden de trabajo no encontrada</p>
        <button onClick={() => router.push('/work-orders')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a órdenes
        </button>
      </div>
    );
  }

  const nextStatuses = NEXT_STATUSES[workOrder.status] || [];
  const isTerminal = ['cancelled', 'closed'].includes(workOrder.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/work-orders')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ORDEN DE TRABAJO</h1>
            <p className="text-sm text-gray-500">{workOrder.title} • #{shortWO(workOrder.workOrderNumber)}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[workOrder.status]}`}>
            {STATUS_OPTIONS[workOrder.status] || workOrder.status}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[workOrder.priority]}`}>
            {PRIORITY_LABELS[workOrder.priority] || workOrder.priority}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* Tabs para navegación rápida */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          <button
            onClick={() => setActiveTab('tecnico')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'tecnico'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🔧 Información del Técnico
          </button>
          <button
            onClick={() => setActiveTab('cliente')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'cliente'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            👤 Cliente y Ubicación
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Pestaña: Información del Técnico */}
          {activeTab === 'tecnico' && (
            <>
              {/* Información para el Técnico */}
              {(workOrder.technicianNotes?.materials || workOrder.technicianNotes?.tools || workOrder.technicianNotes?.additionalNotes) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-blue-900 mb-3">📋 Lo que necesitás saber</h2>
                  <dl className="space-y-2">
                    {workOrder.technicianNotes.materials && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">🎒 Materiales</dt>
                        <dd className="text-sm text-blue-900">{workOrder.technicianNotes.materials}</dd>
                      </div>
                    )}
                    {workOrder.technicianNotes.tools && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">🔧 Herramientas</dt>
                        <dd className="text-sm text-blue-900">{workOrder.technicianNotes.tools}</dd>
                      </div>
                    )}
                    {workOrder.technicianNotes.additionalNotes && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">📝 Notas</dt>
                        <dd className="text-sm text-blue-900">{workOrder.technicianNotes.additionalNotes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Programación */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">📅 Cuándo ir</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Fecha</span>
                    <p className="font-medium">{formatDate(workOrder.scheduledDate)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Horario</span>
                    <p className="font-medium">{formatTime(workOrder.scheduledStart)} - {formatTime(workOrder.scheduledEnd)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Duración est.</span>
                    <p className="font-medium">{workOrder.estimatedDuration ? `${workOrder.estimatedDuration} min` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Prioridad</span>
                    <p className="font-medium">{PRIORITY_LABELS[workOrder.priority] || workOrder.priority}</p>
                  </div>
                </div>
              </div>

              {/* Descripción del trabajo */}
              {workOrder.description && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">📋 Descripción</h2>
                  <p className="text-sm text-gray-700">{workOrder.description}</p>
                </div>
              )}

              {/* Checklist */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">✅ Checklist</h2>
                {loadingChecklist ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {checklist.length === 0 && <p className="text-xs text-gray-500">Sin items</p>}
                    {checklist.map((item) => (
                      <label key={item._id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" checked={item.completed} onChange={() => toggleCheckItem(item)} className="w-4 h-4 rounded text-brand-600" />
                        <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.description}</span>
                      </label>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <input type="text" value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }} placeholder="Nuevo item..." className="flex-1 text-sm border rounded px-2 py-1" />
                      <button onClick={addCheckItem} disabled={addingCheckItem || !newCheckItem.trim()} className="text-xs bg-brand-600 text-white px-3 py-1 rounded">{addingCheckItem ? '...' : 'Agregar'}</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pestaña: Cliente y Ubicación */}
          {activeTab === 'cliente' && (
            <>
              {/* Cliente */}
              {(workOrder.clientSnapshot?.name || workOrder.clientSnapshot?.phone) && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">👤 Cliente</h2>
                  <dl className="space-y-2 text-sm">
                    {workOrder.clientSnapshot?.name && (
                      <div><dt className="text-xs text-gray-500">Nombre</dt><dd className="font-medium">{workOrder.clientSnapshot.name}</dd></div>
                    )}
                    {workOrder.clientSnapshot?.phone && (
                      <div><dt className="text-xs text-gray-500">Teléfono</dt><dd className="font-medium">{workOrder.clientSnapshot.phone}</dd></div>
                    )}
                    {workOrder.clientSnapshot?.email && (
                      <div><dt className="text-xs text-gray-500">Email</dt><dd className="font-medium">{workOrder.clientSnapshot.email}</dd></div>
                    )}
                  </dl>
                </div>
              )}

              {/* Ubicación */}
              {workOrder.locationSnapshot?.address && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">📍 Dónde ir</h2>
                  <dl className="space-y-2 text-sm">
                    {workOrder.locationSnapshot.name && (
                      <div><dt className="text-xs text-gray-500">Lugar</dt><dd className="font-medium">{workOrder.locationSnapshot.name}</dd></div>
                    )}
                    <div><dt className="text-xs text-gray-500">Dirección</dt><dd className="font-medium">{workOrder.locationSnapshot.address}</dd></div>
                    {workOrder.locationSnapshot.city && (
                      <div><dt className="text-xs text-gray-500">Ciudad</dt><dd className="font-medium">{workOrder.locationSnapshot.city}</dd></div>
                    )}
                    {workOrder.locationSnapshot.province && (
                      <div><dt className="text-xs text-gray-500">Provincia</dt><dd className="font-medium">{workOrder.locationSnapshot.province}</dd></div>
                    )}
                    {workOrder.locationSnapshot.details?.reference && (
                      <div><dt className="text-xs text-gray-500">Referencias</dt><dd className="font-medium">{workOrder.locationSnapshot.details.reference}</dd></div>
                    )}
                  </dl>
                  
                  {/* Google Maps button - uses full address */}
                  {(() => {
                    const fullAddress = [
                      workOrder.locationSnapshot.address,
                      workOrder.locationSnapshot.city,
                      workOrder.locationSnapshot.province
                    ].filter(Boolean).join(', ');
                    return (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">
                        📍 Abrir en Google Maps
                      </a>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            {!isTerminal && isAdmin && (
              <button onClick={() => router.push(`/work-orders/${id}/edit`)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Editar OT
              </button>
            )}

            {nextStatuses.length > 0 && isAdmin && (
              <div className="relative">
                <button onClick={() => setShowStatusMenu(!showStatusMenu)} disabled={changingStatus}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  {changingStatus ? 'Cambiando...' : 'Cambiar Estado'}
                </button>
                {showStatusMenu && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {nextStatuses.map((opt) => (
                      <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Self-assign for technicians */}
            {isTechnician && !isTerminal && (workOrder.status === 'scheduled' || workOrder.status === 'assigned') && (
              <button
                onClick={() => setSelfAssignOpen(true)}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Auto-asignar esta OT
              </button>
            )}

            {/* Technician info - visible to all, but buttons only for non-technicians */}
            {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 && (
              <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">Técnico Asignado</span>
                  <span className="text-xs text-brand-600">{technicianName(workOrder)}</span>
                </div>
                {isAdmin && !isTerminal && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowAssignInput(!showAssignInput); if (!showAssignInput) loadTechnicians(); }}
                      className="flex-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                    >
                      Reasignar
                    </button>
                    <button
                      onClick={() => {
                        const tech = workOrder.assignedTechnicians![0];
                        const techId = typeof tech === 'string' ? tech : tech._id;
                        handleUnassign(techId);
                      }}
                      disabled={unassigning}
                      className="flex-1 rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50 transition-colors"
                    >
                      {unassigning ? '...' : 'Desasignar'}
                    </button>
                  </div>
                )}

                {/* Assign / Reassign dropdown - only for admins */}
                {isAdmin && !isTerminal && (!workOrder.assignedTechnicians || workOrder.assignedTechnicians.length === 0 || showAssignInput) && (
                  <div className="space-y-2">
                    {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 && (
                      <p className="text-xs text-gray-500">Seleccionar nuevo técnico:</p>
                    )}
                    {loadingTechnicians ? (
                      <div className="text-xs text-gray-500 py-2">Cargando técnicos...</div>
                    ) : (
                      <select
                        value={assignTechId}
                        onChange={(e) => setAssignTechId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Seleccionar técnico...</option>
                        {technicians.map((tech) => (
                          <option key={tech._id} value={tech._id}>
                            {tech.name}{tech.specialties?.length ? ` — ${tech.specialties.slice(0, 2).join(', ')}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleAssign} disabled={assigning || !assignTechId.trim()}
                        className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                        {assigning ? 'Asignando...' : workOrder.assignedTechnicians?.length ? 'Reasignar' : 'Asignar'}
                      </button>
                      {showAssignInput && (
                        <button onClick={() => { setShowAssignInput(false); setAssignTechId(''); }}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isAdmin && (
              !showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-lg border border-danger-200 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors">
                  Eliminar
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-danger-50 rounded-lg">
                  <p className="text-xs text-danger-700 font-medium">¿Eliminar esta OT?</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} disabled={deleting}
                      className="flex-1 rounded-lg bg-danger-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-600 disabled:opacity-50 transition-colors">
                      {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <SelfAssignmentDrawer
        isOpen={selfAssignOpen}
        onClose={() => setSelfAssignOpen(false)}
        workOrderId={id}
        workOrderNumber={workOrder.workOrderNumber}
        onAssigned={() => {
          // Reload work order after self-assignment
          api.get<{ data: WorkOrder }>(`/api/operations/work-orders/${id}`).then((r) => {
            setWorkOrder(unwrapData(r));
          }).catch(() => {});
        }}
      />
    </div>
  );
}
