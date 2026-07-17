'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORY_OPTIONS = [
  { value: 'budget', label: 'Presupuesto' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'emergency', label: 'Emergencia' },
  { value: 'other', label: 'Otra' },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";

export default function NewTechnicalVisitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    locationName: '',
    locationAddress: '',
    priority: 'normal',
    category: 'budget',
    description: '',
    scheduledDate: '',
    scheduledStart: '',
    scheduledEnd: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
        description: form.description.trim() || undefined,
      };

      if (form.scheduledDate) {
        body.scheduledDate = new Date(form.scheduledDate);
        if (form.scheduledStart) {
          body.scheduledStart = new Date(`${form.scheduledDate}T${form.scheduledStart}`);
        }
        if (form.scheduledEnd) {
          body.scheduledEnd = new Date(`${form.scheduledDate}T${form.scheduledEnd}`);
        }
      }

      const result = await api.post<{ data: { _id: string } }>('/api/operations/technical-visits', body);
      router.push(`/technical-visits/${result.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear visita técnica');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Visita Técnica</h1>
        <p className="text-sm text-gray-500 mt-1">Programá una inspección o presupuesto in-situ</p>
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
                className={inputClass} placeholder="Ej: Inspección equipo de frío" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Visita</label>
              <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select name="priority" value={form.priority} onChange={handleChange} className={inputClass}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange}
                className={inputClass} rows={3} placeholder="Detalles de lo que se debe evaluar..." />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Cliente <span className="text-danger-500">*</span>
              </label>
              <input type="text" name="clientName" value={form.clientName} onChange={handleChange}
                className={inputClass} placeholder="Empresa o nombre" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="clientEmail" value={form.clientEmail} onChange={handleChange}
                className={inputClass} placeholder="contacto@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" name="clientPhone" value={form.clientPhone} onChange={handleChange}
                className={inputClass} placeholder="+54 9 11 1234-5678" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Ubicación</label>
              <input type="text" name="locationName" value={form.locationName} onChange={handleChange}
                className={inputClass} placeholder="Sucursal Centro" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" name="locationAddress" value={form.locationAddress} onChange={handleChange}
                className={inputClass} placeholder="Av. Corrientes 1234" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Programación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" name="scheduledDate" value={form.scheduledDate} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora Inicio</label>
              <input type="time" name="scheduledStart" value={form.scheduledStart} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fin</label>
              <input type="time" name="scheduledEnd" value={form.scheduledEnd} onChange={handleChange}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => router.push('/technical-visits')}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
            {loading ? 'Creando...' : 'Crear Visita Técnica'}
          </button>
        </div>
      </form>
    </div>
  );
}