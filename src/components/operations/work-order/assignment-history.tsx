'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

type AssignmentType =
  | 'initial'
  | 'auto_assignment'
  | 'manual'
  | 'redistribution'
  | 'replacement';

type AssignmentReason =
  | 'customer_request'
  | 'proximity'
  | 'availability'
  | 'coverage'
  | 'specialty'
  | 'priority'
  | 'replacement'
  | 'schedule_change'
  | 'performance'
  | 'other';

interface Technician {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface AssignmentBy {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface AssignmentHistoryItem {
  _id: string;
  workOrderId: string;
  technicianId: Technician;
  previousTechnicianId?: Technician;
  assignmentType: AssignmentType;
  reason: AssignmentReason;
  reasonDetail?: string;
  assignedBy: AssignmentBy;
  assignedAt: string;
  status: string;
  acknowledgedAt?: string;
  declinedAt?: string;
  replacedAt?: string;
  notes?: string;
}

interface AssignmentHistoryProps {
  workOrderId: string;
  onAssignmentClick?: (assignmentId: string) => void;
}

const assignmentTypeLabels: Record<AssignmentType, string> = {
  initial: 'Asignación inicial',
  auto_assignment: 'Auto-asignación',
  manual: 'Asignación manual',
  redistribution: 'Redistribución',
  replacement: 'Reemplazo',
};

const assignmentReasonLabels: Record<AssignmentReason, string> = {
  customer_request: 'Solicitud del cliente',
  proximity: 'Por proximidad',
  availability: 'Por disponibilidad',
  coverage: 'Cobertura de zona',
  specialty: 'Por especialidad',
  priority: 'Por prioridad',
  replacement: 'Reemplazo de compañero',
  schedule_change: 'Cambio en agenda',
  performance: 'Por rendimiento',
  other: 'Otro motivo',
};

export function AssignmentHistory({ workOrderId, onAssignmentClick }: AssignmentHistoryProps) {
  const [history, setHistory] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workOrderId) {
      loadHistory();
    }
  }, [workOrderId]);

  async function loadHistory() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<AssignmentHistoryItem[]>(
        `/api/operations/work-orders/${workOrderId}/assignments?history=true`
      );
      setHistory(data);
    } catch (err) {
      console.error('Error loading assignment history:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return formatDate(dateString);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      assigned: 'bg-blue-100 text-blue-700 border-blue-200',
      acknowledged: 'bg-green-100 text-green-700 border-green-200',
      declined: 'bg-red-100 text-red-700 border-red-200',
      replaced: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    const labels: Record<string, string> = {
      assigned: 'Asignado',
      acknowledged: 'Confirmado',
      declined: 'Rechazado',
      replaced: 'Reemplazado',
    };
    return { style: styles[status] || styles.assigned, label: labels[status] || status };
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={loadHistory}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500 text-sm">No hay historial de asignaciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Historial de Asignaciones
        </h3>
        <span className="text-xs text-gray-500">
          {history.length} asignación{history.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {history.map((assignment, index) => {
            const status = getStatusBadge(assignment.status);
            const isReplacement = assignment.assignmentType === 'replacement';
            const isLatest = index === 0;

            return (
              <div
                key={assignment._id}
                onClick={() => onAssignmentClick?.(assignment._id)}
                className={`relative pl-10 ${
                  onAssignmentClick ? 'cursor-pointer' : ''
                }`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${
                    isLatest
                      ? 'bg-gray-900 ring-2 ring-gray-900 ring-offset-2'
                      : assignment.status === 'declined'
                      ? 'bg-red-500'
                      : assignment.status === 'acknowledged'
                      ? 'bg-green-500'
                      : 'bg-gray-400'
                  }`}
                />

                {/* Card */}
                <div
                  className={`bg-white border rounded-lg p-4 transition-all ${
                    onAssignmentClick
                      ? 'hover:border-gray-300 hover:shadow-sm cursor-pointer'
                      : 'border-gray-200'
                  } ${isLatest ? 'border-gray-300 shadow-md' : 'border-gray-200'}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {assignment.technicianId.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {assignment.technicianId.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {assignment.technicianId.email}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${status.style}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Tipo:
                      </span>
                      <span>{assignmentTypeLabels[assignment.assignmentType]}</span>
                    </div>

                    <div className="flex items-start gap-2 text-gray-600">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide flex-shrink-0">
                        Motivo:
                      </span>
                      <span>{assignmentReasonLabels[assignment.reason]}</span>
                      {assignment.reasonDetail && (
                        <span className="text-gray-500">- {assignment.reasonDetail}</span>
                      )}
                    </div>

                    {/* Previous technician for replacements */}
                    {isReplacement && assignment.previousTechnicianId && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Reemplazó a:
                        </span>
                        <span>{assignment.previousTechnicianId.name}</span>
                      </div>
                    )}

                    {/* Notes */}
                    {assignment.notes && (
                      <div className="bg-gray-50 rounded-lg p-2 text-gray-600">
                        <p className="text-xs">{assignment.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>Asignado por:</span>
                      <span className="font-medium text-gray-700">
                        {assignment.assignedBy.firstName
                          ? `${assignment.assignedBy.firstName} ${assignment.assignedBy.lastName || ''}`
                          : assignment.assignedBy.email}
                      </span>
                    </div>
                    <div className="text-right">
                      <span>{getTimeSince(assignment.assignedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}