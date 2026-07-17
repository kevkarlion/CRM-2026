'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

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
  locationSnapshot?: { name?: string; address?: string };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string } | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
  version?: number;
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
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'emergency', label: 'Emergencia' },
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [form, setForm] = useState({
    title: '',
    priority: 'normal',
    category: 'maintenance',
    description: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    estimatedDuration: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await api.get<{ data: any }>(`/api/operations/work-orders/${id}`);
        const wo = result.data;
        if (!wo) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setWorkOrder(wo);
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
          scheduledDate: datePart(wo.scheduledDate),
          startTime: wo.scheduledStart ? extractLocalTime(wo.scheduledStart) : '',
          endTime: wo.scheduledEnd ? extractLocalTime(wo.scheduledEnd) : '',
          estimatedDuration: wo.estimatedDuration ? String(wo.estimatedDuration) : '',
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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

      body.version = workOrder?.version ?? 0;

      if (approve) {
        body.status = 'scheduled';
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Orden de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos de la orden de trabajo</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Información General</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
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
                <a href={`/quotes/${workOrder.quoteId}`}
                  className="text-sm text-brand-600 hover:underline font-medium">
                  Ver presupuesto →
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <div className={readonlyClass}>{workOrder?.clientSnapshot?.name || '—'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className={readonlyClass}>{workOrder?.clientSnapshot?.email || '—'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <div className={readonlyClass}>{workOrder?.clientSnapshot?.phone || '—'}</div>
            </div>
          </div>
        </div>

        {workOrder?.locationSnapshot?.name && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre/Lugar</label>
                <div className={readonlyClass}>{workOrder.locationSnapshot.name}</div>
              </div>
              {workOrder.locationSnapshot.address && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <div className={readonlyClass}>{workOrder.locationSnapshot.address}</div>
                </div>
              )}
            </div>
          </div>
        )}

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
