'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

interface TechnicalVisit {
  _id: string;
  visitNumber: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot: {
    name: string;
    email?: string;
    phone?: string;
  };
  locationSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
    province?: string;
  };
  result?: {
    findings?: string;
    recommendation?: string;
    estimatedBudget?: number;
    nextSteps?: string;
  };
  convertedToWorkOrderId?: string;
  convertedAt?: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'converted_to_work_order', label: 'Convertido a OT' },
];

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

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  converted_to_work_order: 'bg-purple-50 text-purple-700',
};

function toLocalDatetimeValue(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TechnicalVisitDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [visit, setVisit] = useState<TechnicalVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  const id = params.id as string;

  useEffect(() => {
    loadVisit();
  }, [id]);

  async function loadVisit() {
    try {
      setLoading(true);
      const result = await api.get<{ data: TechnicalVisit }>(`/api/operations/technical-visits/${id}`);
      setVisit(result.data);
      setNewStatus(result.data.status);
      syncEditFields(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  function syncEditFields(v: TechnicalVisit) {
    if (v.scheduledStart) {
      const d = new Date(v.scheduledStart);
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setEditTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else if (v.scheduledDate) {
      const d = new Date(v.scheduledDate);
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setEditTime('09:00');
    } else {
      setEditDate('');
      setEditTime('09:00');
    }
  }

  function enterEdit() {
    if (visit) syncEditFields(visit);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleReschedule() {
    if (!editDate || !editTime) {
      setError('Fecha y hora son requeridas');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const scheduledStart = new Date(`${editDate}T${editTime}:00`);
      await api.patch(`/api/operations/technical-visits/${id}`, {
        scheduledDate: scheduledStart,
        scheduledStart,
      });
      setEditing(false);
      await loadVisit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reprogramar');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange() {
    if (!newStatus || newStatus === visit?.status) return;
    setSaving(true);
    try {
      await api.patch(`/api/operations/technical-visits/${id}`, { status: newStatus });
      await loadVisit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar esta visita técnica?')) return;
    try {
      await api.del(`/api/operations/technical-visits/${id}`);
      router.push('/technical-visits');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">Visita no encontrada</h2>
        <button onClick={() => router.push('/technical-visits')} className="mt-4 text-brand-600">
          Volver a Visitas Técnicas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/technical-visits')} className="text-gray-400 hover:text-gray-600">
          ← Volver
        </button>
        <button onClick={handleDelete} className="text-sm text-danger-600 hover:text-danger-700">
          Eliminar
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold text-gray-900">{visit.visitNumber}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status]}`}>
                {STATUS_OPTIONS.find(o => o.value === visit.status)?.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{visit.title}</h1>
          </div>
          <div className="flex gap-2">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleStatusChange}
              disabled={saving || newStatus === visit.status}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Tipo</span>
            <p className="font-medium">{CATEGORY_OPTIONS.find(o => o.value === visit.category)?.label}</p>
          </div>
          <div>
            <span className="text-gray-500">Prioridad</span>
            <p className="font-medium">{PRIORITY_OPTIONS.find(o => o.value === visit.priority)?.label}</p>
          </div>
          <div>
            <span className="text-gray-500">Fecha Programada</span>
            <p className="font-medium">{visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('es-CL') : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Horario</span>
            <p className="font-medium">
              {visit.scheduledStart ? new Date(visit.scheduledStart).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}
              {visit.scheduledEnd && ` - ${new Date(visit.scheduledEnd).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        {visit.description && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Descripción</h3>
            <p className="text-gray-700">{visit.description}</p>
          </div>
        )}
      </div>

      {/* Reschedule card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Reprogramar</h2>
          {!editing ? (
            <button
              onClick={enterEdit}
              disabled={visit.status === 'completed' || visit.status === 'cancelled'}
              className="px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Editar fecha y hora
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReschedule}
                disabled={saving}
                className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fecha</span>
              <p className="font-medium">{visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('es-CL') : '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Hora</span>
              <p className="font-medium">
                {visit.scheduledStart ? new Date(visit.scheduledStart).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha *</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva hora *</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Client card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Nombre</span>
            <p className="font-medium">{visit.clientSnapshot.name}</p>
          </div>
          {visit.clientSnapshot.email && (
            <div>
              <span className="text-sm text-gray-500">Email</span>
              <p className="font-medium">{visit.clientSnapshot.email}</p>
            </div>
          )}
          {visit.clientSnapshot.phone && (
            <div>
              <span className="text-sm text-gray-500">Teléfono</span>
              <p className="font-medium">{visit.clientSnapshot.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Location card */}
      {visit.locationSnapshot && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visit.locationSnapshot.name && (
              <div>
                <span className="text-sm text-gray-500">Nombre</span>
                <p className="font-medium">{visit.locationSnapshot.name}</p>
              </div>
            )}
            {visit.locationSnapshot.address && (
              <div>
                <span className="text-sm text-gray-500">Dirección</span>
                <p className="font-medium">{visit.locationSnapshot.address}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result card (only for completed visits) */}
      {visit.status === 'completed' && visit.result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Resultado de la Visita</h2>
          {visit.result.findings && (
            <div>
              <span className="text-sm text-gray-500">Hallazgos</span>
              <p className="text-gray-700">{visit.result.findings}</p>
            </div>
          )}
          {visit.result.recommendation && (
            <div>
              <span className="text-sm text-gray-500">Recomendación</span>
              <p className="text-gray-700">{visit.result.recommendation}</p>
            </div>
          )}
          {visit.result.estimatedBudget && (
            <div>
              <span className="text-sm text-gray-500">Presupuesto Estimado</span>
              <p className="text-lg font-bold text-green-600">${visit.result.estimatedBudget.toLocaleString('es-CL')}</p>
            </div>
          )}
        </div>
      )}

      {/* Converted banner */}
      {visit.convertedToWorkOrderId && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-700">
            ✓ Convertida a Orden de Trabajo el {new Date(visit.convertedAt!).toLocaleDateString('es-CL')}
          </p>
        </div>
      )}
    </div>
  );
}
