'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

function getBrowserTimezone(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const mins = String(Math.abs(offset % 60)).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
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

const TYPE_OPTIONS = [
  { value: 'work_order', label: 'Orden de Trabajo' },
  { value: 'technical_visit', label: 'Visita Técnica' },
];

export default function NewWorkOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'work_order',
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
    if (!form.clientName.trim()) { setError('El nombre del cliente es obligatorio'); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        source: form.type === 'technical_visit' ? 'technical_visit' : 'manual',
        priority: form.priority,
        category: form.category,
        clientSnapshot: {
          name: form.clientName.trim(),
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
      }

      if (form.description.trim()) body.description = form.description.trim();
      if (form.scheduledDate) body.scheduledDate = form.scheduledDate;
      if (form.scheduledDate && form.startTime) body.scheduledStart = toISOStringWithLocalTime(form.scheduledDate, form.startTime);
      if (form.scheduledDate && form.endTime) body.scheduledEnd = toISOStringWithLocalTime(form.scheduledDate, form.endTime);
      if (form.estimatedDuration) body.estimatedDuration = parseInt(form.estimatedDuration, 10);

      const result = await api.post<{ data: { _id: string } }>('/api/operations/work-orders', body);
      router.push(`/work-orders/${result.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear orden de trabajo');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Orden de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-1">Ingresa los datos de la orden</p>
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
                Tipo <span className="text-danger-500">*</span>
              </label>
              <div className="flex gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      checked={form.type === opt.value}
                      onChange={handleChange}
                      className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="title" value={form.title} onChange={handleChange}
                className={inputClass} placeholder="Ej: Instalación de equipo split" required />
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
                className={`${inputClass} min-h-[100px] resize-y`} placeholder="Detalles del trabajo a realizar..." />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="clientName" value={form.clientName} onChange={handleChange}
                className={inputClass} placeholder="Cliente" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="clientEmail" value={form.clientEmail} onChange={handleChange}
                className={inputClass} placeholder="cliente@ejemplo.cl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" name="clientPhone" value={form.clientPhone} onChange={handleChange}
                className={inputClass} placeholder="+56 9 1234 5678" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre/Lugar</label>
              <input type="text" name="locationName" value={form.locationName} onChange={handleChange}
                className={inputClass} placeholder="Ej: Domicilio cliente, Oficina..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" name="locationAddress" value={form.locationAddress} onChange={handleChange}
                className={inputClass} placeholder="Av. Principal 123" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Equipo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" name="equipmentType" value={form.equipmentType} onChange={handleChange}
                className={inputClass} placeholder="Ej: Split, Central..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" name="equipmentBrand" value={form.equipmentBrand} onChange={handleChange}
                className={inputClass} placeholder="Ej: Daikin, Carrier..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" name="equipmentModel" value={form.equipmentModel} onChange={handleChange}
                className={inputClass} placeholder="Modelo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Serie</label>
              <input type="text" name="equipmentSerial" value={form.equipmentSerial} onChange={handleChange}
                className={inputClass} placeholder="Serial" />
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
                className={inputClass} placeholder="120" min="1" />
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
          <button type="submit" disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creando...' : 'Crear OT'}
          </button>
          <button type="button" onClick={() => router.push('/work-orders')}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
