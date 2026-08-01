'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, unwrapData } from '@/lib/api-client';
import { Drawer } from '@/lib/components/Drawer';
import { WorkCompletionForm } from '@/operations/components/WorkCompletionForm';
import { useRole } from '@/dashboard/context/role-context';

// Helper to get short visit number (last 7 chars)
function shortVT(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

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
  assignedTechnicianId?: { _id: string; name: string; email?: string; specialties?: string[] } | string | null;
  result?: {
    findings?: string;
    recommendation?: string;
    estimatedBudget?: number;
    nextSteps?: string;
  };
  // Campos adicionales para el técnico
  technicianNotes?: {
    materials?: string;
    tools?: string;
    additionalNotes?: string;
  };
  convertedToWorkOrderId?: string;
  convertedAt?: string;
  // Work execution fields
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  startedBy?: string;
  workReportId?: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'assigned', label: 'Asignada' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'converted_to_work_order', label: 'Convertido a OT' },
];

const NEXT_STATUSES: Record<string, Array<{ value: string; label: string }>> = {
  draft: [{ value: 'scheduled', label: 'Programado' }],
  scheduled: [{ value: 'confirmed', label: 'Confirmado' }, { value: 'cancelled', label: 'Cancelado' }],
  confirmed: [{ value: 'cancelled', label: 'Cancelado' }],
  in_progress: [{ value: 'completed', label: 'Completado' }, { value: 'cancelled', label: 'Cancelado' }],
};

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
  assigned: 'bg-indigo-50 text-indigo-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  converted_to_work_order: 'bg-purple-50 text-purple-700',
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
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
  const [activeTab, setActiveTab] = useState<'tecnico' | 'cliente'>('tecnico');
  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // Assignment state
  const [technicians, setTechnicians] = useState<Array<{ _id: string; name: string; email?: string; specialties?: string[] }>>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignTechId, setAssignTechId] = useState('');
  const [showAssignInput, setShowAssignInput] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Work execution state
  const [startingWork, setStartingWork] = useState(false);
  const [startingWorkError, setStartingWorkError] = useState<string | null>(null);
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  
  const { isAdmin, isTechnician, user } = useRole();

  // Start work handler
  async function handleStartWork() {
    try {
      await api.post<{ data: { status: string; startedAt: string } }>(
        `/api/operations/technical-visits/${id}/start`,
        {}
      );
      // Reload visit to get updated status
      const result = await api.get<{ data: TechnicalVisit }>(`/api/operations/technical-visits/${id}`);
      setVisit(unwrapData(result));
    } catch (err) {
      setStartingWorkError(err instanceof Error ? err.message : 'Error al iniciar trabajo');
    } finally {
      setStartingWork(false);
    }
  }

  // Check if current user is the assigned technician
  const isCurrentUserTheAssignedTech = (): boolean => {
    if (!isTechnician) return false;
    if (!visit?.assignedTechnicianId) return false;
    
    // First, try email comparison from populated field
    const assignedTech = visit.assignedTechnicianId;
    const assignedTechEmail = typeof assignedTech === 'object' ? (assignedTech as any)?.email : null;
    
    if (assignedTechEmail && user.email) {
      if (assignedTechEmail.toLowerCase() === user.email.toLowerCase()) {
        return true;
      }
    }
    
    // Fallback: find current user's technician in the loaded list and compare by ID
    const currentUserTech = technicians.find(t => t.email?.toLowerCase() === user.email?.toLowerCase());
    if (currentUserTech) {
      const assignedTechId = typeof assignedTech === 'object' ? (assignedTech as any)?._id?.toString() : assignedTech?.toString();
      return currentUserTech._id === assignedTechId;
    }
    
    return false;
  };

  // Completion success handler
  function handleCompletionSuccess() {
    setShowCompletionForm(false);
    // Reload visit to get updated status
    api.get<{ data: TechnicalVisit }>(`/api/operations/technical-visits/${id}`).then((r) => {
      setVisit(unwrapData(r));
    }).catch(() => {});
  }

  const id = params.id as string;

  useEffect(() => {
    loadVisit();
    loadTechnicians();
  }, [id]);

  async function loadTechnicians() {
    if (technicians.length > 0) return; // already loaded
    setLoadingTechnicians(true);
    try {
      const result = await api.get<{ data: Array<{ _id: string; name: string; email?: string }> }>('/api/operations/technicians');
      setTechnicians(unwrapData(result) || []);
    } catch {
      // silently ignore
    } finally {
      setLoadingTechnicians(false);
    }
  }

  async function loadVisit() {
    try {
      setLoading(true);
      const result = await api.get<{ data: TechnicalVisit }>(`/api/operations/technical-visits/${id}`);
      const visit = unwrapData<TechnicalVisit>(result);
      setVisit(visit);
      setNewStatus(visit.status);
      syncEditFields(visit);
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

  async function handleStatusChange(status?: string) {
    const targetStatus = status || newStatus;
    if (!targetStatus || targetStatus === visit?.status) return;
    setSaving(true);
    try {
      await api.patch(`/api/operations/technical-visits/${id}`, { status: targetStatus });
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

  async function handleAssign() {
    if (!assignTechId.trim()) return;
    setAssigning(true);
    try {
      const action = visit?.assignedTechnicianId ? 'reassign' : 'assign';
      await api.post(`/api/operations/technical-visits/${id}/assign`, { action, technicianId: assignTechId.trim() });
      setShowAssignInput(false);
      setAssignTechId('');
      await loadVisit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    setUnassigning(true);
    try {
      await api.post(`/api/operations/technical-visits/${id}/assign`, { action: 'unassign' });
      await loadVisit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desasignar');
    } finally {
      setUnassigning(false);
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

  const isTerminal = ['completed', 'cancelled'].includes(visit?.status || '');
  const nextStatuses = NEXT_STATUSES[visit?.status || ''] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/technical-visits')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{visit.title}</h1>
            <p className="text-sm text-gray-500">#{shortVT(visit.visitNumber)}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status]}`}>
            {STATUS_OPTIONS.find(o => o.value === visit.status)?.label}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[visit.priority]}`}>
            {PRIORITY_OPTIONS.find(o => o.value === visit.priority)?.label}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* Tabs */}
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
              {(visit.technicianNotes?.materials || visit.technicianNotes?.tools || visit.technicianNotes?.additionalNotes) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-blue-900 mb-3">📋 Lo que necesitás saber</h2>
                  <dl className="space-y-2">
                    {visit.technicianNotes.materials && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">🎒 Materiales</dt>
                        <dd className="text-sm text-blue-900">{visit.technicianNotes.materials}</dd>
                      </div>
                    )}
                    {visit.technicianNotes.tools && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">🔧 Herramientas</dt>
                        <dd className="text-sm text-blue-900">{visit.technicianNotes.tools}</dd>
                      </div>
                    )}
                    {visit.technicianNotes.additionalNotes && (
                      <div className="flex flex-col">
                        <dt className="text-xs font-medium text-blue-700">📝 Notas</dt>
                        <dd className="text-sm text-blue-900">{visit.technicianNotes.additionalNotes}</dd>
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
                    <p className="font-medium">{visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('es-CL') : '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Horario</span>
                    <p className="font-medium">
                      {visit.scheduledStart ? new Date(visit.scheduledStart).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      {visit.scheduledEnd && ` - ${new Date(visit.scheduledEnd).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Categoría</span>
                    <p className="font-medium">{CATEGORY_OPTIONS.find(o => o.value === visit.category)?.label}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Prioridad</span>
                    <p className="font-medium">{PRIORITY_OPTIONS.find(o => o.value === visit.priority)?.label}</p>
                  </div>
                </div>
              </div>

              {/* Descripción del trabajo */}
              {visit.description && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">📋 Descripción</h2>
                  <p className="text-sm text-gray-700">{visit.description}</p>
                </div>
              )}
            </>
          )}

          {/* Pestaña: Cliente y Ubicación */}
          {activeTab === 'cliente' && (
            <>
              {/* Cliente */}
              {(visit.clientSnapshot?.name || visit.clientSnapshot?.phone) && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">👤 Cliente</h2>
                  <dl className="space-y-2 text-sm">
                    {visit.clientSnapshot?.name && (
                      <div><dt className="text-xs text-gray-500">Nombre</dt><dd className="font-medium">{visit.clientSnapshot.name}</dd></div>
                    )}
                    {visit.clientSnapshot?.phone && (
                      <div><dt className="text-xs text-gray-500">Teléfono</dt><dd className="font-medium">{visit.clientSnapshot.phone}</dd></div>
                    )}
                    {visit.clientSnapshot?.email && (
                      <div><dt className="text-xs text-gray-500">Email</dt><dd className="font-medium">{visit.clientSnapshot.email}</dd></div>
                    )}
                  </dl>
                </div>
              )}

              {/* Ubicación */}
              {visit.locationSnapshot?.address && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">📍 Dónde ir</h2>
                  <dl className="space-y-2 text-sm">
                    {visit.locationSnapshot.name && (
                      <div><dt className="text-xs text-gray-500">Lugar</dt><dd className="font-medium">{visit.locationSnapshot.name}</dd></div>
                    )}
                    <div><dt className="text-xs text-gray-500">Dirección</dt><dd className="font-medium">{visit.locationSnapshot.address}</dd></div>
                    {visit.locationSnapshot.city && (
                      <div><dt className="text-xs text-gray-500">Ciudad</dt><dd className="font-medium">{visit.locationSnapshot.city}</dd></div>
                    )}
                    {visit.locationSnapshot.province && (
                      <div><dt className="text-xs text-gray-500">Provincia</dt><dd className="font-medium">{visit.locationSnapshot.province}</dd></div>
                    )}
                  </dl>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            {nextStatuses.length > 0 && (
              <div className="relative">
                <button onClick={() => setShowStatusMenu(!showStatusMenu)} disabled={saving}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  {saving ? 'Cambiando...' : 'Cambiar Estado'}
                </button>
                {showStatusMenu && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {nextStatuses.map((opt) => (
                      <button key={opt.value} onClick={() => { handleStatusChange(opt.value); setShowStatusMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Work Execution Status - Show when work has started */}
            {(visit.status === 'in_progress' || visit.status === 'completed') && visit.startedAt && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-700">Estado del Trabajo</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    visit.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {visit.status === 'in_progress' ? 'En Curso' : 'Completado'}
                  </span>
                </div>
                <div className="text-xs text-amber-800 space-y-1">
                  <p>
                    <span className="font-medium">Inicio:</span>{' '}
                    {new Date(visit.startedAt).toLocaleString('es-CL', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                  {visit.finishedAt && (
                    <p>
                      <span className="font-medium">Término:</span>{' '}
                      {new Date(visit.finishedAt).toLocaleString('es-CL', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                  {visit.duration && (
                    <p>
                      <span className="font-medium">Duración:</span>{' '}
                      {visit.duration >= 60
                        ? `${Math.floor(visit.duration / 60)}h ${visit.duration % 60}min`
                        : `${visit.duration} min`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Work Execution Buttons - Only for assigned technician */}
            {isCurrentUserTheAssignedTech() && !isTerminal && (
              <>
                {/* Start Work button - show when status is 'assigned' or 'scheduled' */}
                {(visit.status === 'assigned' || visit.status === 'scheduled') && (
                  <>
                    {startingWorkError && (
                      <div className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
                        {startingWorkError}
                      </div>
                    )}
                    <button
                      onClick={handleStartWork}
                      disabled={startingWork}
                      className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors min-h-[48px]"
                    >
                      {startingWork ? 'Iniciando...' : '▶ Iniciar Trabajo'}
                    </button>
                  </>
                )}

                {/* Complete Work button - show when status is 'in_progress' */}
                {visit.status === 'in_progress' && (
                  <button
                    onClick={() => setShowCompletionForm(true)}
                    className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 transition-colors min-h-[48px]"
                  >
                    ✓ Finalizar Servicio
                  </button>
                )}
              </>
            )}

            {/* Technician info */}
            {visit.assignedTechnicianId && (
              <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">Técnico Asignado</span>
                </div>
                <span className="text-sm font-medium text-brand-900">
                  {typeof visit.assignedTechnicianId === 'object' ? visit.assignedTechnicianId.name : '—'}
                </span>
                {!isTerminal && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowAssignInput(!showAssignInput); if (!showAssignInput) loadTechnicians(); }}
                      className="flex-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                    >
                      Reasignar
                    </button>
                    <button
                      onClick={handleUnassign}
                      disabled={unassigning}
                      className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50 transition-colors"
                    >
                      {unassigning ? '...' : 'Quitar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!visit.assignedTechnicianId && !isTerminal && (
              <button
                onClick={() => { setShowAssignInput(!showAssignInput); if (!showAssignInput) loadTechnicians(); }}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Asignar Técnico
              </button>
            )}

            {showAssignInput && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                {loadingTechnicians ? (
                  <div className="text-xs text-gray-500 py-2">Cargando...</div>
                ) : (
                  <select
                    value={assignTechId}
                    onChange={(e) => setAssignTechId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
                  >
                    <option value="">Seleccionar técnico...</option>
                    {technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <button onClick={handleAssign} disabled={assigning || !assignTechId.trim()}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {assigning ? '...' : 'Asignar'}
                  </button>
                  <button onClick={() => { setShowAssignInput(false); setAssignTechId(''); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Result card for completed visits */}
          {visit.status === 'completed' && visit.result && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Resultado</h3>
              {visit.result.findings && (
                <div>
                  <span className="text-xs text-gray-500">Hallazgos</span>
                  <p className="text-sm text-gray-700">{visit.result.findings}</p>
                </div>
              )}
              {visit.result.recommendation && (
                <div>
                  <span className="text-xs text-gray-500">Recomendación</span>
                  <p className="text-sm text-gray-700">{visit.result.recommendation}</p>
                </div>
              )}
              {visit.result.estimatedBudget && (
                <div>
                  <span className="text-xs text-gray-500">Presupuesto Est.</span>
                  <p className="text-lg font-bold text-green-600">${visit.result.estimatedBudget.toLocaleString('es-CL')}</p>
                </div>
              )}
            </div>
          )}

          {/* Converted banner */}
          {visit.convertedToWorkOrderId && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm text-purple-700">
                ✓ Convertida a OT el {visit.convertedAt ? new Date(visit.convertedAt).toLocaleDateString('es-CL') : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Work Completion Drawer */}
      <Drawer
        isOpen={showCompletionForm}
        onClose={() => setShowCompletionForm(false)}
        title="Finalizar Servicio"
      >
        <WorkCompletionForm
          technicalVisitId={id}
          onSuccess={handleCompletionSuccess}
          onCancel={() => setShowCompletionForm(false)}
        />
      </Drawer>
    </div>
  );
}
