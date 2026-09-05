'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { useVisiblePolling } from '@/lib/use-visible-polling';
import { useFollowUpMarks, type FollowUpMark } from '@/leads/pipeline-board/hooks/useFollowUpMarks';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface CurrentUser {
  userId: string;
  email: string;
  tenantId: string;
  firstName: string;
  lastName: string;
}

function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.userId || !payload.email) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId || 'default',
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
    };
  } catch {
    return null;
  }
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Status labels + modern palette (matching the pipeline board semantics).
const STATUS_LABELS: Record<string, string> = {
  // lead
  new: 'Nuevo',
  contacted: 'Contactado',
  quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica',
  negotiation: 'Negociación',
  qualified: 'Calificado',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
  closed: 'Cerrado',
  // client
  none: 'Sin operación',
  quote_pending: 'Presupuesto pendiente',
  visit_scheduled: 'Visita programada',
  sale_confirmed: 'Venta confirmada',
  active: 'Activo',
  inactive: 'Inactivo',
};

const STATUS_VARIANTS: Record<string, string> = {
  // lead — solid badges, clearly separated hues
  new: 'bg-sky-600 text-white',
  contacted: 'bg-violet-600 text-white',
  quote_sent: 'bg-indigo-600 text-white',
  technical_visit: 'bg-teal-600 text-white',
  negotiation: 'bg-amber-500 text-gray-900',
  qualified: 'bg-emerald-600 text-white',
  won: 'bg-emerald-700 text-white',
  lost: 'bg-rose-600 text-white',
  disqualified: 'bg-gray-600 text-white',
  closed: 'bg-gray-700 text-white',
  // client
  none: 'bg-gray-100 text-gray-700',
  quote_pending: 'bg-amber-500 text-gray-900',
  visit_scheduled: 'bg-teal-600 text-white',
  sale_confirmed: 'bg-emerald-700 text-white',
  active: 'bg-emerald-600 text-white',
  inactive: 'bg-gray-200 text-gray-600',
};

function getStatusLabel(status?: string): string {
  if (!status) return '';
  return STATUS_LABELS[status] || status;
}

function getStatusVariant(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-700';
  return STATUS_VARIANTS[status] || 'bg-gray-100 text-gray-700';
}

export default function AtencionPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [filter, setFilter] = useState<'all' | 'lead' | 'client'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { marks, loading, error, fetchMarks, deleteMark } = useFollowUpMarks();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);
    fetchMarks(user.email);
  }, [router, fetchMarks]);

  // Polling para actualizaciones en tiempo real — visibility-aware 15s loop.
  // Per-user key dedupes against the global toast loop (`follow-up-marks:all`)
  // only when appropriate: this page filters by the signed-in user's email
  // (`userEmail=<email>`), while AttentionToast fetches all marks with
  // `userAll=true` and filters client-side by assignedTo. Different payloads,
  // different loops — they coexist without double-fetching the same URL.
  const currentUserEmail = currentUser?.email ?? '';
  const fetchCurrentUserMarks = useCallback(async () => {
    if (!currentUserEmail) return;
    await fetchMarks(currentUserEmail);
  }, [currentUserEmail, fetchMarks]);

  useVisiblePolling({
    key: `follow-up-marks:user:${currentUserEmail}`,
    interval: 15_000,
    fetcher: fetchCurrentUserMarks,
    enabled: !!currentUser,
  });

  const handleUnmark = useCallback(async (markId: string) => {
    await deleteMark(markId);
  }, [deleteMark]);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteMark(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMark]);

  const filteredMarks = filter === 'all' 
    ? marks 
    : marks.filter(m => m.targetType === filter);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Atención</h1>
          <p className="text-sm text-gray-500 mt-1">
            Leads y clientes asignados para seguimiento
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setFilter('all')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({marks.length})
          </button>
          <button
            onClick={() => setFilter('lead')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'lead'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Leads ({marks.filter(m => m.targetType === 'lead').length})
          </button>
          <button
            onClick={() => setFilter('client')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'client'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Clientes ({marks.filter(m => m.targetType === 'client').length})
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Cargando...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredMarks.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No hay elementos</h3>
          <p className="text-sm text-gray-500 mt-1 px-6">
            {filter === 'all' 
              ? 'No tienes leads ni clientes marcados para seguimiento.'
              : filter === 'lead'
                ? 'No tienes leads marcados para seguimiento.'
                : 'No tienes clientes marcados para seguimiento.'
            }
          </p>
        </div>
      )}

      {/* Table - desktop only, cards for mobile */}
      {!loading && filteredMarks.length > 0 && (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Para
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha / Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nota
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMarks.map((mark) => (
                  <MarkRow
                    key={mark._id}
                    mark={mark}
                    onRequestUnmark={(id, name) => setDeleteTarget({ id, name })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filteredMarks.map((mark) => (
              <MarkCard
                key={mark._id}
                mark={mark}
                onRequestUnmark={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title="Quitar seguimiento"
          message={`¿Estás seguro de que quieres quitar la marca de seguimiento de "${deleteTarget.name}"?`}
          confirmLabel="Sí, quitar"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

interface MarkCardProps {
  mark: FollowUpMark;
  onRequestUnmark: (id: string, name: string) => void;
}

function MarkCard({ mark, onRequestUnmark }: MarkCardProps) {
  const [unmarking, setUnmarking] = useState(false);

  const handleUnmark = async () => {
    setUnmarking(true);
    await onRequestUnmark(mark._id, mark.target?.name || 'este elemento');
    setUnmarking(false);
  };

  const handleClick = () => {
    if (mark.targetType === 'lead') {
      window.location.href = `/leads/${mark.targetId}`;
    } else {
      window.location.href = `/clients/${mark.targetId}`;
    }
  };

  return (
    <div className={`bg-white border border-gray-200 border-l-4 rounded-xl p-4 shadow-sm ${
      mark.targetType === 'lead' ? 'border-l-sky-500' : 'border-l-emerald-600'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={handleClick}>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${
              mark.targetType === 'lead' 
                ? 'bg-sky-50 text-sky-700 border-sky-200' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {mark.targetType === 'lead' ? 'Lead' : 'Cliente'}
            </span>
            {mark.target?.status && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${getStatusVariant(mark.target.status)}`}>
                {getStatusLabel(mark.target.status)}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-gray-900 hover:text-brand-700 transition-colors">
            {mark.target?.name || `ID: ${mark.targetId}`}
          </h3>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Para</div>
              <div className="text-sm font-medium text-gray-900 break-words">
                {mark.markedByUser?.name || mark.assignedTo || '—'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fecha</div>
              <div className="text-sm font-medium text-gray-900 break-words">
                {mark.markedAt ? formatDateTime(mark.markedAt) : '—'}
              </div>
            </div>
          </div>

          {mark.note && (
            <div className="border-l-4 border-l-amber-400 bg-amber-50 rounded-r-lg px-3 py-2 mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Nota</div>
              <p className="text-sm font-medium text-gray-900 break-words">{mark.note}</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleUnmark}
        disabled={unmarking}
        className="mt-3 w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {unmarking ? 'Quitando...' : 'Quitar seguimiento'}
      </button>
    </div>
  );
}

interface MarkRowProps {
  mark: FollowUpMark;
  onRequestUnmark: (id: string, name: string) => void;
}

function MarkRow({ mark, onRequestUnmark }: MarkRowProps) {
  const [unmarking, setUnmarking] = useState(false);

  const handleUnmark = async () => {
    setUnmarking(true);
    await onRequestUnmark(mark._id, mark.target?.name || 'este elemento');
    setUnmarking(false);
  };

  const handleClick = () => {
    if (mark.targetType === 'lead') {
      window.location.href = `/leads/${mark.targetId}`;
    } else {
      window.location.href = `/clients/${mark.targetId}`;
    }
  };

  return (
    <tr className="border-b border-gray-100 even:bg-gray-100/50 odd:bg-white hover:bg-brand-50/40 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${
          mark.targetType === 'lead' 
            ? 'bg-sky-50 text-sky-700 border-sky-200' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {mark.targetType === 'lead' ? 'Lead' : 'Cliente'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleClick}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
        >
          {mark.target?.name || `ID: ${mark.targetId}`}
        </button>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {mark.target?.status && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${getStatusVariant(mark.target.status)}`}>
            {getStatusLabel(mark.target.status)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
        {mark.markedByUser?.name || mark.assignedTo}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
        {mark.markedAt && formatDateTime(mark.markedAt)}
      </td>
      <td className="px-4 py-3">
        {mark.note && (
          <span className="text-sm text-gray-600 max-w-[200px] truncate block" title={mark.note}>
            {mark.note}
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          onClick={handleUnmark}
          disabled={unmarking}
          className="px-3 py-1.5 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {unmarking ? 'Quitando...' : 'Quitar'}
        </button>
      </td>
    </tr>
  );
}
