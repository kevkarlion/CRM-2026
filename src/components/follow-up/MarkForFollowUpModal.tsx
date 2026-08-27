'use client';

import { useState, useEffect } from 'react';
import type { FollowUpMark } from '@/leads/pipeline-board/hooks/useFollowUpMarks';

interface UserOption {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface MarkForFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (mark: FollowUpMark) => void;
  entityType: 'lead' | 'client';
  entityId: string;
  entityName: string;
  users?: UserOption[];
  existingMark?: FollowUpMark | null;
  onDelete?: (markId: string) => Promise<boolean>;
  // Optional functions from useFollowUpMarks hook
  createMark?: (data: {
    leadId?: string;
    clientId?: string;
    assignedTo: string;
    note?: string;
  }) => Promise<FollowUpMark | null>;
  deleteMarkFn?: (markId: string) => Promise<boolean>;
}

export function MarkForFollowUpModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
  users = [],
  existingMark,
  onDelete,
  createMark,
  deleteMarkFn,
}: MarkForFollowUpModalProps) {
  const [assignedTo, setAssignedTo] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAssignedTo(existingMark?.assignedTo || 'ro.lija@hotmail.com');
      setNote(existingMark?.note || '');
      setError(null);
    }
  }, [isOpen, existingMark]);

  if (!isOpen) return null;

  const isEditing = !!existingMark;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!assignedTo.trim()) {
      setError('Selecciona un usuario');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data = {
        leadId: entityType === 'lead' ? entityId : undefined,
        clientId: entityType === 'client' ? entityId : undefined,
        assignedTo: assignedTo.trim(),
        note: note.trim() || undefined,
      };

      let newMark: FollowUpMark | null = null;

      if (createMark) {
        // Use the provided createMark function (from useFollowUpMarks hook)
        newMark = await createMark(data);
      } else {
        // Fallback: direct fetch
        const headers: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              headers['Authorization'] = `Bearer ${token}`;
              headers['x-tenant-id'] = payload.tenantId || 'default';
              headers['x-user-id'] = payload.userId || '';
            } catch {
              headers['Authorization'] = `Bearer ${token}`;
            }
          }
        }

        const res = await fetch('/api/follow-up-marks', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }

        newMark = await res.json();
      }

      if (newMark) {
        onSuccess?.(newMark);
        onClose();
      } else {
        throw new Error('Error al crear marca de seguimiento');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear marca de seguimiento';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existingMark) return;
    
    if (!confirm('¿Estás seguro de que quieres quitar esta marca de seguimiento?')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      let success = false;

      if (deleteMarkFn) {
        success = await deleteMarkFn(existingMark._id);
      } else if (onDelete) {
        success = await onDelete(existingMark._id);
      }

      if (success) {
        onClose();
      } else {
        setError('Error al eliminar la marca');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar marca de seguimiento');
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {isEditing ? 'Seguimiento' : 'Marcar para seguimiento'}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {entityType === 'lead' ? 'Lead' : 'Cliente'}: {entityName}
        </p>

        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">{error}</div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
              <div className="px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-100">
                {existingMark?.assignedTo}
              </div>
            </div>
            
            {existingMark?.note && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota</label>
                <div className="px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-100">
                  {existingMark.note}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg border border-danger-200 px-5 py-2 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Quitando...' : 'Quitar seguimiento'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fixed assignment - always ro.lija@hotmail.com */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asignar a
              </label>
              <div className="px-3 py-2 text-sm bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-medium">
                ⏰ ro.lija@hotmail.com
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Agrega una nota..."
                className={`${inputClass} min-h-[60px] resize-y`}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Marcando...' : 'Marcar para seguimiento'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
