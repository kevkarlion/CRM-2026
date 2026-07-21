'use client';

import { useState } from 'react';
import { Drawer } from '@/lib/components/Drawer';
import { api } from '@/lib/api-client';

interface SelfAssignmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  workOrderNumber: string;
  onAssigned: () => void;
}

const REASON_OPTIONS = [
  { value: 'near_client', label: 'Estoy cerca del cliente' },
  { value: 'available_time', label: 'Tengo tiempo disponible' },
  { value: 'replacement', label: 'Reemplazo a un compañero' },
  { value: 'redistribution', label: 'Redistribución del trabajo' },
  { value: 'high_priority', label: 'Prioridad alta' },
  { value: 'other', label: 'Otro' },
];

export function SelfAssignmentDrawer({
  isOpen,
  onClose,
  workOrderId,
  workOrderNumber,
  onAssigned,
}: SelfAssignmentDrawerProps) {
  const [reason, setReason] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setReason('');
    setObservations('');
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!reason) {
      setError('Seleccioná un motivo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/api/operations/work-orders/${workOrderId}/self-assign`, {
        reason,
        observations: observations || undefined,
      });

      resetForm();
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al auto-asignar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={`Auto-asignar OT #${workOrderNumber}`}
      footer={
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !reason}
            className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Asignando...' : 'Auto-asignar'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm rounded-lg p-3">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Motivo <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          >
            <option value="">Seleccionar motivo...</option>
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Detalles adicionales sobre la auto-asignación..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
          />
        </div>
      </div>
    </Drawer>
  );
}
