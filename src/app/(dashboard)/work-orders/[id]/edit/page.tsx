'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useRole } from '@/dashboard/context/role-context';
import {
  LocationActions,
} from '@/components/location';

interface WorkOrderData {
  _id: string;
  title: string;
  description?: string;
  priority: string;
  category: string;
  source: string;
  status: string;
  quoteId?: string | null;
  clientSnapshot?: { name?: string; email?: string; phone?: string };
  locationSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    details?: {
      floor?: string;
      apartment?: string;
      tower?: string;
      office?: string;
      neighborhood?: string;
      block?: string;
      lot?: string;
      reference?: string;
      observations?: string;
    };
  };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string } | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
  version?: number;
  technicianNotes?: {
    materials?: string;
    tools?: string;
    additionalNotes?: string;
  };
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string } | string>;
}

function extractLocalTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function toISOStringWithLocalTime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  return dt.toISOString();
}

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORY_OPTIONS = [
  { value: 'installation', label: 'Instalación' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'repair', label: 'Reparación' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'warranty', label: 'Garantía' },
  { value: 'emergency', label: 'Emergencia' },
];

export default function EditWorkOrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, isAdmin } = useRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [technicians, setTechnicians] = useState<Array<{ _id: string; name: string; email?: string }>>([]);
  const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'scheduled', label: 'Programada' },
  { value: 'assigned', label: 'Asignada' },
  { value: 'in_progress', label: 'En ejecucion' },
  { value: 'paused', label: 'En pausa' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

function getAvailableTransitions(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    scheduled: ['assigned', 'in_progress', 'paused', 'cancelled'],
    assigned: ['in_progress', 'paused', 'cancelled'],
    in_progress: ['paused', 'completed', 'cancelled'],
    paused: ['in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
    // Legacy
    draft: ['scheduled', 'assigned', 'cancelled'],
    pending_assignment: ['scheduled', 'cancelled'],
    confirmed: ['scheduled', 'cancelled'],
  };
  return transitions[currentStatus] || [];
}

const [form, setForm] = useState({
    title: '',
    priority: 'normal',
    category: 'maintenance',
    description: '',
    status: 'draft',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    estimatedDuration: '',
    assignedTechnician: '',
    materials: '',
    tools: '',
    additionalNotes: '',
    // Client fields (editable for admins)
    clientName: '',
    clientEmail: '',
    // Location fields
    locationAddress: '',
    locationCity: '',
    locationProvince: '',
    locationReference: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    placeId: undefined as string | undefined,
    locationDetails: {
      floor: '', apartment: '', tower: '', office: '',
      neighborhood: '', block: '', lot: '', reference: '', observations: '',
    },
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        
        // Load work order and technicians in parallel
        const [woResult, techResult] = await Promise.all([
          api.get<{ data: any }>(`/api/operations/work-orders/${id}`),
          api.get<{ data: Array<{ _id: string; name: string; email?: string }> }>('/api/operations/technicians').catch(() => ({ data: [] })),
        ]);
        
        const wo = woResult.data;
        setTechnicians(techResult?.data || []);
        
        if (!wo) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setWorkOrder(wo);
        
        // Get assigned technician ID
        let assignedTechId = '';
        if (wo.assignedTechnicians && wo.assignedTechnicians.length > 0) {
          const first = wo.assignedTechnicians[0];
          assignedTechId = typeof first === 'string' ? first : (first as any)._id;
        }
        
        function datePart(dt?: string) {
          if (!dt) return '';
          try { return dt.substring(0, 10); }
          catch { return ''; }
        }
        setForm({
          title: wo.title || '',
          priority: wo.priority || 'normal',
          category: wo.category || 'maintenance',
          description: wo.description || '',
          status: wo.status || 'draft',
          // Client fields
          clientName: wo.clientSnapshot?.name || '',
          clientEmail: wo.clientSnapshot?.email || '',
          scheduledDate: datePart(wo.scheduledDate),
          startTime: wo.scheduledStart ? extractLocalTime(wo.scheduledStart) : '',
          endTime: wo.scheduledEnd ? extractLocalTime(wo.scheduledEnd) : '',
          estimatedDuration: wo.estimatedDuration ? String(wo.estimatedDuration) : '',
          assignedTechnician: assignedTechId,
          materials: wo.technicianNotes?.materials || '',
          tools: wo.technicianNotes?.tools || '',
          additionalNotes: wo.technicianNotes?.additionalNotes || '',
          locationAddress: wo.locationSnapshot?.address || '',
          locationCity: wo.locationSnapshot?.city || '',
          locationProvince: wo.locationSnapshot?.province || '',
          latitude: wo.locationSnapshot?.latitude,
          longitude: wo.locationSnapshot?.longitude,
          locationReference: wo.locationSnapshot?.details?.reference || wo.locationSnapshot?.details?.observations || '',
          placeId: wo.locationSnapshot?.placeId,
          locationDetails: {
            floor: wo.locationSnapshot?.details?.floor || '',
            apartment: wo.locationSnapshot?.details?.apartment || '',
            tower: wo.locationSnapshot?.details?.tower || '',
            office: wo.locationSnapshot?.details?.office || '',
            neighborhood: wo.locationSnapshot?.details?.neighborhood || '',
            block: wo.locationSnapshot?.details?.block || '',
            lot: wo.locationSnapshot?.details?.lot || '',
            reference: wo.locationSnapshot?.details?.reference || '',
            observations: wo.locationSnapshot?.details?.observations || '',
          },
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Use browser GPS to get current location
  // Removed - not needed without geocoding API

  // Cambiar workStatus (estado de negocio)
  async function handleWorkStatusChange(newWorkStatus: string) {
    setSaving(true);
    setError(null);
    try {
      const version = workOrder?.version ?? 0;
      
      await api.patch<{ data: any }>(`/api/operations/work-orders/${id}`, {
        workStatus: newWorkStatus,
        version: version,
      });
      
      // Reload the work order
      const woResult = await api.get<{ data: any }>(`/api/operations/work-orders/${id}`);
      setWorkOrder(woResult.data);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(approve: boolean) {
    setError(null);

    if (!form.title.trim()) { setError('El título es obligatorio'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        priority: form.priority,
        category: form.category,
      };

      if (form.description.trim()) body.description = form.description.trim();
      if (form.scheduledDate) body.scheduledDate = form.scheduledDate;
      if (form.scheduledDate && form.startTime) body.scheduledStart = toISOStringWithLocalTime(form.scheduledDate, form.startTime);
      if (form.scheduledDate && form.endTime) body.scheduledEnd = toISOStringWithLocalTime(form.scheduledDate, form.endTime);
      if (form.estimatedDuration) body.estimatedDuration = parseInt(form.estimatedDuration, 10);
      
      // Technician assignment
      if (form.assignedTechnician) {
        body.assignedTechnicians = [form.assignedTechnician];
      }

      // Client snapshot - only editable for admins
      if (isAdmin && (form.clientName.trim() || form.clientEmail.trim())) {
        body.clientSnapshot = {
          ...(workOrder?.clientSnapshot || {}),
          name: form.clientName.trim() || undefined,
          email: form.clientEmail.trim() || undefined,
        };
      }
      
      // Technician notes
      if (form.materials.trim() || form.tools.trim() || form.additionalNotes.trim()) {
        body.technicianNotes = {
          materials: form.materials.trim() || undefined,
          tools: form.tools.trim() || undefined,
          additionalNotes: form.additionalNotes.trim() || undefined,
        };
      }
      
      // Location - include all new fields
      if (form.locationAddress.trim() || form.locationCity.trim() || form.locationProvince.trim() || form.latitude || form.longitude) {
        const locationDetails = {
          floor: form.locationDetails.floor || undefined,
          apartment: form.locationDetails.apartment || undefined,
          tower: form.locationDetails.tower || undefined,
          office: form.locationDetails.office || undefined,
          neighborhood: form.locationDetails.neighborhood || undefined,
          block: form.locationDetails.block || undefined,
          lot: form.locationDetails.lot || undefined,
          reference: form.locationDetails.reference || undefined,
          observations: form.locationDetails.observations || undefined,
        };

        // Simple location with reference/observations
        body.locationSnapshot = {
          address: form.locationAddress.trim(),
          city: form.locationCity.trim() || undefined,
          province: form.locationProvince.trim() || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
          details: form.locationReference.trim() ? { reference: form.locationReference.trim() } : undefined,
        };
      }

      body.version = workOrder?.version ?? 0;

      // Si el usuario cambió el status explícitamente, usarlo
      const targetStatus = form.status;
      const currentStatus = workOrder?.status;
      
      if (approve && targetStatus && targetStatus !== currentStatus) {
        // Cambiar status vía endpoint dedicado
        try {
          await api.post(`/api/operations/work-orders/${id}/status`, {
            status: targetStatus,
            version: workOrder?.version ?? 0,
          });
        } catch (statusErr: any) {
          // Si falla el cambio de status, mostrar error pero continuar con el resto
          if (statusErr?.response?.data?.error) {
            setError(statusErr.response.data.error);
            setSaving(false);
            return;
          }
          throw statusErr;
        }
      }

      await api.patch(`/api/operations/work-orders/${id}`, body);
      router.push(`/work-orders/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Orden de trabajo no encontrada</p>
        <button onClick={() => router.push('/work-orders')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a órdenes
        </button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';
  const readonlyClass = 'w-full rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600';

  // WorkStatus control logic
  // workStatus: campo de negocio (active/paused/cancelled)
  // status: campo operativo (draft/scheduled/assigned/in_progress/paused/completed/cancelled/closed)
  const currentWorkStatus = workOrder?.workStatus || 'active';
  const isWorkCancelled = currentWorkStatus === 'cancelled';
  const isWorkPaused = currentWorkStatus === 'paused';
  const isWorkActive = currentWorkStatus === 'active';
  const isWorkCompleted = currentWorkStatus === 'completed';
  
  // No se puede cambiar workStatus si el status operativo es closed, cancelled o in_progress
  const canChangeWorkStatus = !['closed', 'cancelled', 'in_progress'].includes(workOrder?.status || '') && !isWorkCompleted;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with status badge and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Orden de Trabajo</h1>
          {/* Badge de estado al lado del titulo */}
          <span className={`px-3 py-1 text-sm rounded-lg font-medium ${
            isWorkActive ? 'bg-green-100 text-green-800' : 
            isWorkPaused ? 'bg-amber-100 text-amber-800' : 
            isWorkCompleted ? 'bg-blue-100 text-blue-800' : 
            'bg-red-100 text-red-800'
          }`}>
            {isWorkActive ? 'Activa' : isWorkPaused ? 'Pausada' : isWorkCompleted ? 'Completada' : 'Cancelada'}
          </span>
        </div>
        
        {/* Botones de accion al lado opuesto */}
        {!isWorkCancelled && canChangeWorkStatus && (
          <div className="flex gap-2">
            {isWorkActive && (
              <button
                type="button"
                onClick={() => handleWorkStatusChange('paused')}
                disabled={saving}
                className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                Pausar
              </button>
            )}
            {isWorkPaused && (
              <button
                type="button"
                onClick={() => handleWorkStatusChange('active')}
                disabled={saving}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Iniciar
              </button>
            )}
            <button
              type="button"
              onClick={() => handleWorkStatusChange('cancelled')}
              disabled={saving}
              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900 pb-3 border-b-2 border-gray-300 mt-6">Información General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="title" value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select name="priority" value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className={inputClass}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select name="category" value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className={inputClass}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className={`${inputClass} min-h-[100px] resize-y`} />
            </div>
          </div>
        </div>

        {workOrder?.quoteId && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Presupuesto Origen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Presupuesto</label>
                <div className={readonlyClass}>{workOrder.quoteId}</div>
              </div>
              <div className="flex items-end">
                <Link href={`/quotes/${workOrder.quoteId}`}
                  className="text-sm text-brand-600 hover:underline font-medium">
                  Ver presupuesto →
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900 pb-3 border-b-2 border-gray-300 mt-6">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              {isAdmin ? (
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Nombre del cliente"
                />
              ) : (
                <div className={readonlyClass}>{workOrder?.clientSnapshot?.name || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {isAdmin ? (
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="email@ejemplo.com"
                />
              ) : (
                <div className={readonlyClass}>{workOrder?.clientSnapshot?.email || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <div className={readonlyClass}>{workOrder?.clientSnapshot?.phone || '—'}</div>
            </div>
          </div>
        </div>

        {/* Location - simple manual entry */}
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900 pb-3 border-b-2 border-gray-300 mt-6">📍 Ubicación del servicio</h2>
          
          {/* Address - simple input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input type="text" name="locationAddress" value={form.locationAddress}
              onChange={(e) => setForm((p) => ({ ...p, locationAddress: e.target.value }))}
              className={inputClass} placeholder="Ej: Av. San Martín 1250, General Roca, Río Negro" />
            
            {/* Build full address for Google Maps */}
            {(() => {
              const fullAddress = [form.locationAddress, form.locationCity, form.locationProvince]
                .filter(Boolean).join(', ');
              return (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 underline">
                  📍 Ver en Google Maps
                </a>
              );
            })()}
          </div>

          {/* City and Province */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" name="locationCity" value={form.locationCity}
                onChange={(e) => setForm((p) => ({ ...p, locationCity: e.target.value }))}
                className={inputClass} placeholder="Ej: General Roca" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Región/Provincia</label>
              <input type="text" name="locationProvince" value={form.locationProvince}
                onChange={(e) => setForm((p) => ({ ...p, locationProvince: e.target.value }))}
                className={inputClass} placeholder="Ej: Río Negro" />
            </div>
          </div>

          {/* Link a Google Maps para obtener coordenadas */}
          {form.locationAddress && form.locationCity && (
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.locationAddress, form.locationCity, form.locationProvince].filter(Boolean).join(', '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 underline"
            >
              📍 Abrir en Google Maps para obtener coordenadas
            </a>
          )}

          {/* Additional Location Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referencias / Observaciones</label>
            <textarea name="locationReference" value={form.locationReference || ''}
              onChange={(e) => setForm((p) => ({ ...p, locationReference: e.target.value }))}
              className={inputClass} rows={2}
              placeholder="Ej: Portón gris, timbre 4, casa del fondo..." />
          </div>

          {/* Coordenadas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coordenadas <span className="text-gray-400">(lat, lng)</span>
            </label>
            <input 
              type="text" 
              name="coordinates" 
              value={form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : ''}
              onChange={(e) => {
                const value = e.target.value.trim();
                const match = value.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
                if (match) {
                  setForm((p) => ({ 
                    ...p, 
                    latitude: parseFloat(match[1]), 
                    longitude: parseFloat(match[2]) 
                  }));
                } else if (value === '') {
                  setForm((p) => ({ ...p, latitude: undefined, longitude: undefined }));
                }
              }}
              className={inputClass} 
              placeholder="Ej: -33.4489, -70.6693" 
            />
          </div>
        </div>

        {workOrder?.equipmentSnapshot && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Equipo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {workOrder.equipmentSnapshot.equipmentType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <div className={readonlyClass}>{workOrder.equipmentSnapshot.equipmentType}</div>
                </div>
              )}
              {workOrder.equipmentSnapshot.brand && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <div className={readonlyClass}>{workOrder.equipmentSnapshot.brand}</div>
                </div>
              )}
              {workOrder.equipmentSnapshot.model && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                  <div className={readonlyClass}>{workOrder.equipmentSnapshot.model}</div>
                </div>
              )}
              {workOrder.equipmentSnapshot.serialNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° Serie</label>
                  <div className={readonlyClass}>{workOrder.equipmentSnapshot.serialNumber}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technician Assignment */}
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900 pb-3 border-b-2 border-gray-300 mt-6">Técnico</h2>
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignar técnico</label>
              <select value={form.assignedTechnician}
                onChange={(e) => setForm((p) => ({ ...p, assignedTechnician: e.target.value }))}
                className={inputClass}>
                <option value="">Seleccionar técnico...</option>
                {technicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>{tech.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Technician Notes */}
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Notas del Técnico</h2>
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Materiales necesarios</label>
              <textarea value={form.materials}
                onChange={(e) => setForm((p) => ({ ...p, materials: e.target.value }))}
                rows={3}
                className={inputClass} placeholder="Ej: Cables UTP, Conectores RJ45, Canaletas..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Herramientas necesarias</label>
              <textarea value={form.tools}
                onChange={(e) => setForm((p) => ({ ...p, tools: e.target.value }))}
                rows={3}
                className={inputClass} placeholder="Ej: Taladro, Destornillador, Crimpeadora..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea value={form.additionalNotes}
                onChange={(e) => setForm((p) => ({ ...p, additionalNotes: e.target.value }))}
                rows={3}
                className={inputClass} placeholder="Ej: El portón está dañado, entrar a pie..." />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Programación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
              <input type="date" name="scheduledDate" value={form.scheduledDate}
                onChange={(e) => setForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración estimada (min)</label>
              <input type="number" name="estimatedDuration" value={form.estimatedDuration}
                onChange={(e) => setForm((p) => ({ ...p, estimatedDuration: e.target.value }))}
                className={inputClass} min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" name="startTime" value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora término</label>
              <input type="time" name="endTime" value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => handleSubmit(false)} disabled={saving}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => handleSubmit(true)} disabled={saving}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md">
            {saving ? 'Guardando...' : 'Guardar y Programar'}
          </button>
          <button type="button" onClick={() => router.push(`/work-orders/${id}`)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ml-auto">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
