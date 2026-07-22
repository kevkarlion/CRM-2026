'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/lib/components/Drawer';
import { api } from '@/lib/api-client';
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
  version: number;
  clientSnapshot?: { name?: string; email?: string; phone?: string; taxId?: string; customerType?: string };
  locationSnapshot?: { name?: string; address?: string; city?: string; province?: string };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string; status?: string } | null;
  leadId?: string | null;
  quoteId?: string | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
  assignedTechnicians?: string[];
  createdAt: string;
  updatedAt: string;
}

interface WorkOrderDetailResponse {
  workOrder: WorkOrder;
  temporalInfo?: { status: string; scheduledStart?: string; scheduledEnd?: string };
}

interface WorkOrderDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
}

const STATUS_CONFIG: Record<string, { variant: string; label: string }> = {
  draft: { variant: 'bg-gray-100 text-gray-700', label: 'Borrador' },
  scheduled: { variant: 'bg-blue-50 text-blue-700', label: 'Programado' },
  confirmed: { variant: 'bg-green-50 text-green-700', label: 'Confirmado' },
  assigned: { variant: 'bg-amber-50 text-amber-700', label: 'Asignado' },
  en_route: { variant: 'bg-blue-50 text-blue-700', label: 'En Camino' },
  on_site: { variant: 'bg-purple-50 text-purple-700', label: 'En Sitio' },
  paused: { variant: 'bg-yellow-50 text-yellow-700', label: 'Suspendido' },
  completed: { variant: 'bg-green-50 text-green-700', label: 'Completado' },
  cancelled: { variant: 'bg-red-50 text-red-700', label: 'Cancelado' },
  closed: { variant: 'bg-gray-400 text-gray-700', label: 'Cerrado' },
};

const STATUS_ACTIONS: Record<string, { status: string; label: string }[]> = {
  draft: [
    { status: '__schedule__', label: 'Programar' },
    { status: 'cancelled', label: 'Cancelar' },
  ],
  scheduled: [
    { status: 'completed', label: 'Completar' },
    { status: 'cancelled', label: 'Cancelar' },
    { status: 'paused', label: 'Suspender' },
    { status: '__reschedule__', label: 'Reagendar' },
  ],
  paused: [
    { status: 'scheduled', label: 'Reanudar' },
    { status: 'cancelled', label: 'Cancelar' },
    { status: '__reschedule__', label: 'Reagendar' },
  ],
  completed: [],
  cancelled: [],
  confirmed: [],
  assigned: [],
  en_route: [],
  on_site: [],
  closed: [],
};

function getBrowserTimezone(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const mins = String(Math.abs(offset % 60)).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

function extractLocalTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 text-right max-w-[60%] truncate" title={value}>{value || '—'}</span>
    </div>
  );
}

export function WorkOrderDetailDrawer({ isOpen, onClose, workOrderId }: WorkOrderDetailDrawerProps) {
  const router = useRouter();
  const [data, setData] = useState<WorkOrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Schedule / Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'schedule' | 'reschedule'>('schedule');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    loadData();
  }, [isOpen, workOrderId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      setShowReschedule(false);
      setStatusError(null);
      const res = await api.get<{ data: WorkOrderDetailResponse }>(`/api/operations/work-orders/${workOrderId}`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!data) return;
    setStatusLoading(newStatus);
    setStatusError(null);
    try {
      const res = await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}/status`, {
        status: newStatus,
        version: data.workOrder.version,
      });
      // Re-fetch full detail to refresh version and related info
      await loadData();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setStatusLoading(null);
    }
  }

  function openSchedule(mode: 'schedule' | 'reschedule') {
    if (!data) return;
    setScheduleMode(mode);
    setShowReschedule(true);
    if (data.workOrder.scheduledDate) {
      setRescheduleDate(data.workOrder.scheduledDate.split('T')[0]);
    } else {
      setRescheduleDate('');
    }
    if (data.workOrder.scheduledStart) {
      setRescheduleStart(extractLocalTime(data.workOrder.scheduledStart));
    } else {
      setRescheduleStart('');
    }
    if (data.workOrder.scheduledEnd) {
      setRescheduleEnd(extractLocalTime(data.workOrder.scheduledEnd));
    } else {
      setRescheduleEnd('');
    }
  }

  async function handleReschedule() {
    if (!data || !rescheduleDate) return;
    setRescheduling(true);
    setStatusError(null);
    try {
      const tz = getBrowserTimezone();
      const scheduledStart = rescheduleStart
        ? `${rescheduleDate}T${rescheduleStart}:00${tz}`
        : `${rescheduleDate}T09:00:00${tz}`;
      const scheduledEnd = rescheduleEnd
        ? `${rescheduleDate}T${rescheduleEnd}:00${tz}`
        : `${rescheduleDate}T18:00:00${tz}`;

      if (data.workOrder.status === 'draft') {
        // First: save dates
        const updateRes = await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}`, {
          scheduledDate: rescheduleDate,
          scheduledStart,
          scheduledEnd,
          version: data.workOrder.version,
        });
        // Then: transition to scheduled with fresh version
        await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}/status`, {
          status: 'scheduled',
          version: updateRes.data.version,
        });
      } else if (data.workOrder.status === 'paused') {
        // First: transition from paused → scheduled
        const statusRes = await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}/status`, {
          status: 'scheduled',
          version: data.workOrder.version,
        });
        // Second: PATCH dates with the new version from the status change response
        await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}`, {
          scheduledDate: rescheduleDate,
          scheduledStart,
          scheduledEnd,
          version: statusRes.data.version,
        });
      } else {
        // Already scheduled: just update dates
        await api.patch<{ data: WorkOrder }>(`/api/operations/work-orders/${workOrderId}`, {
          scheduledDate: rescheduleDate,
          scheduledStart,
          scheduledEnd,
          version: data.workOrder.version,
        });
      }

      setShowReschedule(false);
      await loadData();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Error al reagendar');
    } finally {
      setRescheduling(false);
    }
  }

  const wo = data?.workOrder;
  const actions = wo ? STATUS_ACTIONS[wo.status] || [] : [];
  const isTerminal = ['completed', 'cancelled', 'closed'].includes(wo?.status || '');
  const statusBadge = wo ? STATUS_CONFIG[wo.status] : null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={wo ? `OT #${wo.workOrderNumber}` : 'Orden de Trabajo'}>
      {loading && (
        <div className="space-y-4 p-4">
          <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-20 w-full bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        </div>
      )}

      {error && !data && (
        <div className="p-4">
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
        </div>
      )}

      {wo && !loading && (
        <div className="space-y-5 p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{wo.title}</h3>
              <p className="text-sm text-gray-500">#{wo.workOrderNumber}</p>
            </div>
            {statusBadge && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusBadge.variant}`}>
                {statusBadge.label}
              </span>
            )}
          </div>

          {/* Status Actions */}
          {!isTerminal && actions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Acciones</p>
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => {
                  if (action.status === '__reschedule__' || action.status === '__schedule__') {
                    return (
                      <button
                        key={action.status}
                        onClick={() => openSchedule(action.status === '__schedule__' ? 'schedule' : 'reschedule')}
                        disabled={statusLoading !== null}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {action.label}
                      </button>
                    );
                  }
                  const isDanger = action.status === 'cancelled';
                  const isPrimary = action.status === 'completed' || action.status === 'scheduled';
                  return (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(action.status)}
                      disabled={statusLoading !== null}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                        isDanger
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : isPrimary
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {statusLoading === action.status ? '...' : action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status error */}
          {statusError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {statusError}
            </div>
          )}

          {/* Schedule / Reschedule form */}
          {showReschedule && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                {scheduleMode === 'schedule' ? 'Programar visita' : 'Reagendar visita'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">Inicio</label>
                  <input
                    type="time"
                    value={rescheduleStart}
                    onChange={(e) => setRescheduleStart(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">Término</label>
                  <input
                    type="time"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReschedule}
                  disabled={rescheduling || !rescheduleDate}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {rescheduling ? 'Guardando...' : scheduleMode === 'schedule' ? 'Programar' : 'Confirmar Reagendación'}
                </button>
                <button
                  onClick={() => setShowReschedule(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Main Info */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Información General</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <DetailRow label="# OT" value={wo.workOrderNumber} />
              <DetailRow label="Título" value={wo.title} />
              <DetailRow label="Estado" value={statusBadge?.label || wo.status} />
              <DetailRow label="Prioridad" value={wo.priority} />
              <DetailRow label="Categoría" value={wo.category} />
              <DetailRow label="Origen" value={wo.source === 'maintenance_contract' ? 'Contrato Mantención' : 'Manual'} />
            </div>
          </div>

          {/* Scheduling */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Programación</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <DetailRow label="Fecha" value={formatDate(wo.scheduledDate)} />
              <DetailRow label="Inicio" value={formatTime(wo.scheduledStart)} />
              <DetailRow label="Término" value={formatTime(wo.scheduledEnd)} />
              <DetailRow label="Duración estimada" value={wo.estimatedDuration ? `${wo.estimatedDuration} min` : '—'} />
            </div>
          </div>

          {/* Client */}
          {wo.clientSnapshot && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Cliente</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                {wo.clientSnapshot.name && <DetailRow label="Nombre" value={wo.clientSnapshot.name} />}
                {wo.clientSnapshot.email && <DetailRow label="Email" value={wo.clientSnapshot.email} />}
                {wo.clientSnapshot.phone && <DetailRow label="Teléfono" value={wo.clientSnapshot.phone} />}
                {wo.clientSnapshot.customerType && <DetailRow label="Tipo" value={wo.clientSnapshot.customerType} />}
              </div>
            </div>
          )}

          {/* Location */}
          {wo.locationSnapshot && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ubicación</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                {wo.locationSnapshot.name && <DetailRow label="Lugar" value={wo.locationSnapshot.name} />}
                {wo.locationSnapshot.address && <DetailRow label="Dirección" value={wo.locationSnapshot.address} />}
                {wo.locationSnapshot.city && <DetailRow label="Ciudad" value={wo.locationSnapshot.city} />}
                {wo.locationSnapshot.province && <DetailRow label="Provincia" value={wo.locationSnapshot.province} />}
              </div>
            </div>
          )}

          {/* Equipment */}
          {wo.equipmentSnapshot && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Equipo</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                {wo.equipmentSnapshot.equipmentType && <DetailRow label="Tipo" value={wo.equipmentSnapshot.equipmentType} />}
                {wo.equipmentSnapshot.brand && <DetailRow label="Marca" value={wo.equipmentSnapshot.brand} />}
                {wo.equipmentSnapshot.model && <DetailRow label="Modelo" value={wo.equipmentSnapshot.model} />}
                {wo.equipmentSnapshot.serialNumber && <DetailRow label="N° Serie" value={wo.equipmentSnapshot.serialNumber} />}
                {wo.equipmentSnapshot.status && <DetailRow label="Estado" value={wo.equipmentSnapshot.status} />}
              </div>
            </div>
          )}

          {/* Technician */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Técnico Asignado</p>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">
              {wo.assignedTechnicians && wo.assignedTechnicians.length > 0
                ? wo.assignedTechnicians.map((t: any) => t.name || String(t)).join(', ')
                : 'Sin asignar'}
            </p>
          </div>

          {/* Description */}
          {wo.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Descripción</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{wo.description}</p>
            </div>
          )}

          {/* Reference IDs */}
          {(wo.leadId || wo.quoteId) && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Referencias</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                {wo.leadId && <DetailRow label="Lead ID" value={wo.leadId} />}
                {wo.quoteId && <DetailRow label="Presupuesto ID" value={wo.quoteId} />}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-gray-100 pt-3 space-y-1">
            <p className="text-xs text-gray-400">Creado: {formatDateTime(wo.createdAt)}</p>
            <p className="text-xs text-gray-400">Actualizado: {formatDateTime(wo.updatedAt)}</p>
          </div>

          {/* Link to full detail */}
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => { onClose(); router.push(`/work-orders/${workOrderId}`); }}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Ver detalle completo →
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
