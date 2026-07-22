'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { VisitReportForm } from '@/operations/components/VisitReportForm';
import { formatDateLong as formatDate } from '@/operations/helpers/date-utils';

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
  locationSnapshot?: { name?: string; address?: string };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string } | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string } | string>;
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
  return new Date(dateStr).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
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

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await api.get<{ data: WorkOrder }>(`/api/operations/work-orders/${id}`);
        setWorkOrder(result.data);
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
      const result = await api.get<Array<{ _id: string; name: string; email?: string; specialties?: string[] }>>('/api/operations/technicians');
      setTechnicians(result || []);
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
      setChecklist(result.data || []);
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
      setReport(result.data);
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
      setWorkOrder(result.data);
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
      setWorkOrder(result.data);
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
      setWorkOrder(result.data);
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{workOrder.title}</h1>
            <p className="text-sm text-gray-500">{workOrder.workOrderNumber}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Información General</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="# OT" value={workOrder.workOrderNumber} />
              <DetailRow label="Título" value={workOrder.title} />
              <DetailRow label="Prioridad" value={PRIORITY_LABELS[workOrder.priority] || workOrder.priority} />
              <DetailRow label="Categoría" value={workOrder.category} />
              <DetailRow label="Origen" value={workOrder.source === 'maintenance_contract' ? 'Contrato Mantención' : 'Manual'} />
              <DetailRow label="Técnico Asignado" value={technicianName(workOrder)} />
              <DetailRow label="Creado" value={formatDate(workOrder.createdAt)} />
              <DetailRow label="Actualizado" value={formatDate(workOrder.updatedAt)} />
            </dl>
          </div>

          {(workOrder.clientSnapshot?.name || workOrder.locationSnapshot?.name) && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Cliente y Ubicación</h2>
              <dl className="divide-y divide-gray-100">
                {workOrder.clientSnapshot?.name && (
                  <DetailRow label="Cliente" value={workOrder.clientSnapshot.name} />
                )}
                {workOrder.clientSnapshot?.email && (
                  <DetailRow label="Email" value={workOrder.clientSnapshot.email} />
                )}
                {workOrder.clientSnapshot?.phone && (
                  <DetailRow label="Teléfono" value={workOrder.clientSnapshot.phone} />
                )}
                {workOrder.locationSnapshot?.name && (
                  <DetailRow label="Lugar" value={workOrder.locationSnapshot.name} />
                )}
                {workOrder.locationSnapshot?.address && (
                  <DetailRow label="Dirección" value={workOrder.locationSnapshot.address} />
                )}
              </dl>
            </div>
          )}

          {workOrder.equipmentSnapshot && (workOrder.equipmentSnapshot.equipmentType || workOrder.equipmentSnapshot.brand) && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Equipo</h2>
              <dl className="divide-y divide-gray-100">
                <DetailRow label="Tipo" value={workOrder.equipmentSnapshot.equipmentType || '—'} />
                <DetailRow label="Marca" value={workOrder.equipmentSnapshot.brand || '—'} />
                <DetailRow label="Modelo" value={workOrder.equipmentSnapshot.model || '—'} />
                <DetailRow label="N° Serie" value={workOrder.equipmentSnapshot.serialNumber || '—'} />
              </dl>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Programación</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Fecha" value={formatDate(workOrder.scheduledDate)} />
              <DetailRow label="Hora Inicio" value={formatTime(workOrder.scheduledStart)} />
              <DetailRow label="Hora Término" value={formatTime(workOrder.scheduledEnd)} />
              <DetailRow label="Duración" value={
                workOrder.estimatedDuration ? `${workOrder.estimatedDuration} min` : '—'
              } />
            </dl>
          </div>

          {workOrder.description && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Descripción</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.description}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Checklist</h2>
            {loadingChecklist ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {checklist.length === 0 && (
                  <p className="text-sm text-gray-500">Sin items en el checklist</p>
                )}
                {checklist.map((item) => (
                  <label key={item._id} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleCheckItem(item)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.description}
                    </span>
                  </label>
                ))}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newCheckItem}
                    onChange={(e) => setNewCheckItem((e.target as any).value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }}
                    placeholder="Nuevo item..."
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                  <button onClick={addCheckItem} disabled={addingCheckItem || !newCheckItem.trim()}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {addingCheckItem ? '...' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {report && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Informe de Visita</h2>
                <button
                  onClick={() => setShowReportForm(!showReportForm)}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  {showReportForm ? 'Ver resumen' : 'Editar'}
                </button>
              </div>

              {showReportForm ? (
                <VisitReportForm
                  workOrderId={id}
                  report={report}
                  onSaved={(updated) => setReport(updated)}
                />
              ) : (
                <dl className="divide-y divide-gray-100">
                  {report.workPerformed && <DetailRow label="Trabajo realizado" value={report.workPerformed} />}
                  {report.observations && <DetailRow label="Observaciones" value={report.observations} />}
                  {report.recommendations && <DetailRow label="Recomendaciones" value={report.recommendations} />}
                  {report.materialsUsed && <DetailRow label="Materiales" value={report.materialsUsed} />}
                  {report.materialsItems && report.materialsItems.length > 0 && (
                    <DetailRow
                      label="Ítems de materiales"
                      value={report.materialsItems.map((m) => `${m.item} (${m.quantity} ${m.unit})`).join(', ')}
                    />
                  )}
                  {report.needsNextVisit && <DetailRow label="Próxima visita" value="Sí" />}
                  {report.internalComments && <DetailRow label="Comentarios internos" value={report.internalComments} />}
                  {report.attachments && report.attachments.length > 0 && (
                    <DetailRow
                      label="Archivos adjuntos"
                      value={report.attachments.map((a) => a.filename).join(', ')}
                    />
                  )}
                </dl>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            {!isTerminal && (
              <button onClick={() => router.push(`/work-orders/${id}/edit`)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Editar OT
              </button>
            )}

            {nextStatuses.length > 0 && (
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

            {!isTerminal && (
              <>
                {/* Current technician info */}
                {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 && (
                  <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-brand-700">Técnico Asignado</span>
                      <span className="text-xs text-brand-600">{technicianName(workOrder)}</span>
                    </div>
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
                  </div>
                )}

                {/* Assign / Reassign dropdown */}
                {(!workOrder.assignedTechnicians || workOrder.assignedTechnicians.length === 0 || showAssignInput) && (
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
              </>
            )}

            {!showDeleteConfirm ? (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
