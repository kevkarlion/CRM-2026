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
  clientSnapshot?: { name?: string; email?: string; phone?: string };
  locationSnapshot?: { name?: string; address?: string };
  equipmentSnapshot?: { equipmentType?: string; brand?: string; model?: string; serialNumber?: string } | null;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDuration?: number;
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
  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    locationName: '',
    locationAddress: '',
    equipmentType: '',
    equipmentBrand: '',
    equipmentModel: '',
    equipmentSerial: '',
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
        const result = await api.get<{ data: WorkOrderData }>(`/api/operations/work-orders/${id}`);
        const wo = result.data;
        function timePart(dt?: string) {
          if (!dt) return '';
          try { return new Date(dt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false }); }
          catch { return ''; }
        }
        function datePart(dt?: string) {
          if (!dt) return '';
          try { return dt.substring(0, 10); }
          catch { return ''; }
        }
        setForm({
          title: wo.title || '',
          clientName: wo.clientSnapshot?.name || '',
          clientEmail: wo.clientSnapshot?.email || '',
          clientPhone: wo.clientSnapshot?.phone || '',
          locationName: wo.locationSnapshot?.name || '',
          locationAddress: wo.locationSnapshot?.address || '',
          equipmentType: wo.equipmentSnapshot?.equipmentType || '',
          equipmentBrand: wo.equipmentSnapshot?.brand || '',
          equipmentModel: wo.equipmentSnapshot?.model || '',
          equipmentSerial: wo.equipmentSnapshot?.serialNumber || '',
          priority: wo.priority || 'normal',
          category: wo.category || 'maintenance',
          description: wo.description || '',
          scheduledDate: datePart(wo.scheduledDate),
          startTime: wo.scheduledStart ? timePart(wo.scheduledStart) : '',
          endTime: wo.scheduledEnd ? timePart(wo.scheduledEnd) : '',
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

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    update((e.target as any).name, (e.target as any).value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) { setError('El título es obligatorio'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        priority: form.priority,
        category: form.category,
        clientSnapshot: {
          name: form.clientName.trim() || undefined,
          email: form.clientEmail.trim() || undefined,
          phone: form.clientPhone.trim() || undefined,
        },
        locationSnapshot: {
          name: form.locationName.trim() || undefined,
          address: form.locationAddress.trim() || undefined,
        },
      };

      const hasEquipment = form.equipmentType || form.equipmentBrand || form.equipmentModel || form.equipmentSerial;
      if (hasEquipment) {
        body.equipmentSnapshot = {
          equipmentType: form.equipmentType.trim() || undefined,
          brand: form.equipmentBrand.trim() || undefined,
          model: form.equipmentModel.trim() || undefined,
          serialNumber: form.equipmentSerial.trim() || undefined,
        };
      } else {
        body.equipmentSnapshot = null;
      }

      if (form.description.trim()) body.description = form.description.trim();
      if (form.scheduledDate) body.scheduledDate = form.scheduledDate;
      if (form.startTime) body.scheduledStart = form.startTime;
      if (form.endTime) body.scheduledEnd = form.endTime;
      if (form.estimatedDuration) body.estimatedDuration = parseInt(form.estimatedDuration, 10);

      await api.put(`/api/operations/work-orders/${id}`, body);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar OT</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza los datos de la orden de trabajo</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Información General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="title" value={form.title} onChange={handleChange}
                className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select name="priority" value={form.priority} onChange={handleChange} className={inputClass}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange}
                className={`${inputClass} min-h-[100px] resize-y`} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" name="clientName" value={form.clientName} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="clientEmail" value={form.clientEmail} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" name="clientPhone" value={form.clientPhone} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre/Lugar</label>
              <input type="text" name="locationName" value={form.locationName} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" name="locationAddress" value={form.locationAddress} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Equipo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" name="equipmentType" value={form.equipmentType} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" name="equipmentBrand" value={form.equipmentBrand} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" name="equipmentModel" value={form.equipmentModel} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Serie</label>
              <input type="text" name="equipmentSerial" value={form.equipmentSerial} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Programación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
              <input type="date" name="scheduledDate" value={form.scheduledDate} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración estimada (min)</label>
              <input type="number" name="estimatedDuration" value={form.estimatedDuration} onChange={handleChange}
                className={inputClass} min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora término</label>
              <input type="time" name="endTime" value={form.endTime} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={() => router.push(`/work-orders/${id}`)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
