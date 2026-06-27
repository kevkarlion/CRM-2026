'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

interface Equipment {
  _id: string;
  name: string;
  model?: string;
  serialNumber?: string;
  location?: string;
}

interface Schedule {
  _id: string;
  dueDate: string;
  status: string;
  description?: string;
}

interface Contract {
  _id: string;
  name: string;
  client: { _id: string; name: string; email?: string } | string;
  description?: string;
  status: string;
  startDate: string;
  endDate: string;
  frequency: { interval: number; unit: string };
  equipment: Equipment[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'expired', label: 'Expirado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-success-50 text-success-700',
  paused: 'bg-warning-50 text-warning-700',
  expired: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-danger-50 text-danger-700',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNewEquipment, setShowNewEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({ name: '', model: '', serialNumber: '', location: '' });
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<Contract>(`/api/crm/contracts/${id}`);
        setContract(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar contrato');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const data = await api.get<Schedule[]>(`/api/crm/contracts/${id}/schedules`);
        setSchedules(Array.isArray(data) ? data : []);
      } catch {
        // silently ignore
      }
    }
    loadSchedules();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/crm/contracts/${id}`);
      router.push('/contracts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleAction(action: string, endpoint: string) {
    setActionLoading(action);
    try {
      const updated = await api.post<Contract>(endpoint, {});
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${action}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddEquipment() {
    if (!newEquipment.name.trim()) return;
    setEquipmentLoading(true);
    try {
      const updated = await api.post<Contract>(`/api/crm/contracts/${id}/equipment`, {
        name: newEquipment.name.trim(),
        model: newEquipment.model.trim() || undefined,
        serialNumber: newEquipment.serialNumber.trim() || undefined,
        location: newEquipment.location.trim() || undefined,
      });
      setContract(updated);
      setNewEquipment({ name: '', model: '', serialNumber: '', location: '' });
      setShowNewEquipment(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar equipo');
    } finally {
      setEquipmentLoading(false);
    }
  }

  async function handleRemoveEquipment(equipmentId: string) {
    try {
      const updated = await api.del<Contract>(`/api/crm/contracts/${id}/equipment/${equipmentId}`);
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar equipo');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await api.post(`/api/crm/contracts/${id}/generate`, {});
      const data = await api.get<Schedule[]>(`/api/crm/contracts/${id}/schedules`);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar órdenes');
    } finally {
      setGenerating(false);
    }
  }

  function clientName(c: Contract): string {
    if (!c.client) return '—';
    if (typeof c.client === 'object') return c.client.name;
    return c.client;
  }

  function frequencyLabel(freq: { interval: number; unit: string }): string {
    const unitLabels: Record<string, string> = { days: 'días', months: 'meses', years: 'años' };
    return `Cada ${freq.interval} ${unitLabels[freq.unit] || freq.unit}`;
  }

  function scheduleStatusVariant(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      overdue: 'bg-danger-50 text-danger-700',
      completed: 'bg-success-50 text-success-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  }

  function scheduleStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      overdue: 'Vencida',
      completed: 'Completada',
    };
    return map[status] || status;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Contrato no encontrado</p>
        <button onClick={() => router.push('/contracts')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a contratos
        </button>
      </div>
    );
  }

  const isTerminal = ['expired', 'cancelled'].includes(contract.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/contracts')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{contract.name}</h1>
            <p className="text-sm text-gray-500">{clientName(contract)}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[contract.status]}`}>
            {STATUS_OPTIONS.find((o) => o.value === contract.status)?.label || contract.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Información del Contrato</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Nombre" value={contract.name} />
              <DetailRow label="Cliente" value={clientName(contract)} />
              <DetailRow label="Estado" value={STATUS_OPTIONS.find((o) => o.value === contract.status)?.label || contract.status} />
              <DetailRow label="Fecha de Inicio" value={formatDate(contract.startDate)} />
              <DetailRow label="Fecha de Término" value={formatDate(contract.endDate)} />
              <DetailRow label="Frecuencia" value={frequencyLabel(contract.frequency)} />
              <DetailRow label="Creado" value={formatDate(contract.createdAt)} />
              <DetailRow label="Actualizado" value={formatDate(contract.updatedAt)} />
            </dl>
          </div>

          {contract.description && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Descripción</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.description}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Equipos</h2>
              <button onClick={() => setShowNewEquipment(!showNewEquipment)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Equipo
              </button>
            </div>

            {showNewEquipment && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
                    <input type="text" value={newEquipment.name}
                      onChange={(e) => setNewEquipment((prev) => ({ ...prev, name: (e.target as any).value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
                    <input type="text" value={newEquipment.model}
                      onChange={(e) => setNewEquipment((prev) => ({ ...prev, model: (e.target as any).value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">N° Serie</label>
                    <input type="text" value={newEquipment.serialNumber}
                      onChange={(e) => setNewEquipment((prev) => ({ ...prev, serialNumber: (e.target as any).value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ubicación</label>
                    <input type="text" value={newEquipment.location}
                      onChange={(e) => setNewEquipment((prev) => ({ ...prev, location: (e.target as any).value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddEquipment} disabled={equipmentLoading || !newEquipment.name.trim()}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {equipmentLoading ? 'Agregando...' : 'Agregar'}
                  </button>
                  <button onClick={() => { setShowNewEquipment(false); setNewEquipment({ name: '', model: '', serialNumber: '', location: '' }); }}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {contract.equipment && contract.equipment.length > 0 ? (
              <div className="space-y-2">
                {contract.equipment.map((eq) => (
                  <div key={eq._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{eq.name}</p>
                      <p className="text-xs text-gray-500">
                        {[eq.model, eq.serialNumber, eq.location].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <button onClick={() => handleRemoveEquipment(eq._id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin equipos registrados</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Órdenes de Mantención</h2>
              <button onClick={handleGenerate} disabled={generating || isTerminal}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {generating ? 'Generando...' : 'Generar Órdenes'}
              </button>
            </div>

            {schedules.length > 0 ? (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div key={s._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-900">
                        {s.description || `Mantención - ${formatDate(s.dueDate)}`}
                      </p>
                      <p className="text-xs text-gray-500">Vence: {formatDate(s.dueDate)}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${scheduleStatusVariant(s.status)}`}>
                      {scheduleStatusLabel(s.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin órdenes generadas. Presiona "Generar Órdenes" para crear las órdenes de mantención según la frecuencia del contrato.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            <button onClick={() => router.push(`/contracts/${id}/edit`)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Editar Contrato
            </button>

            {['draft', 'paused'].includes(contract.status) && (
              <button onClick={() => handleAction('activar', `/api/crm/contracts/${id}/activate`)} disabled={actionLoading === 'activar'}
                className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50 transition-colors">
                {actionLoading === 'activar' ? 'Activando...' : 'Activar'}
              </button>
            )}

            {contract.status === 'active' && (
              <button onClick={() => handleAction('pausar', `/api/crm/contracts/${id}/pause`)} disabled={actionLoading === 'pausar'}
                className="w-full rounded-lg bg-warning-500 px-4 py-2 text-sm font-medium text-white hover:bg-warning-600 disabled:opacity-50 transition-colors">
                {actionLoading === 'pausar' ? 'Pausando...' : 'Pausar'}
              </button>
            )}

            {['active', 'paused'].includes(contract.status) && (
              <button onClick={() => handleAction('cancelar', `/api/crm/contracts/${id}/cancel`)} disabled={actionLoading === 'cancelar'}
                className="w-full rounded-lg border border-danger-200 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50 transition-colors">
                {actionLoading === 'cancelar' ? 'Cancelando...' : 'Cancelar Contrato'}
              </button>
            )}

            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-lg border border-danger-200 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors">
                Eliminar
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-danger-50 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">¿Eliminar este contrato?</p>
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
