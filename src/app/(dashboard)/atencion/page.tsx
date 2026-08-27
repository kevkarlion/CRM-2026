'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Atención</h1>
        <p className="text-gray-500 mt-1">
          Leads y clientes asignados para seguimiento
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos ({marks.length})
        </button>
        <button
          onClick={() => setFilter('lead')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'lead'
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Leads ({marks.filter(m => m.targetType === 'lead').length})
        </button>
        <button
          onClick={() => setFilter('client')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'client'
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Clientes ({marks.filter(m => m.targetType === 'client').length})
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">
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
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="text-lg font-medium text-gray-900">No hay elementos</h3>
          <p className="text-gray-500 mt-1">
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
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    Marcado por
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
          <div className="md:hidden space-y-3">
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 cursor-pointer" onClick={handleClick}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              mark.targetType === 'lead' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {mark.targetType === 'lead' ? 'Lead' : 'Cliente'}
            </span>
            {mark.target?.status && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {mark.target.status}
              </span>
            )}
          </div>
          
          <h3 className="text-base font-semibold text-brand-600 hover:underline">
            {mark.target?.name || `ID: ${mark.targetId}`}
          </h3>
          
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            <p>
              <span className="text-gray-400">Marcado por:</span>{' '}
              {mark.markedByUser?.name || mark.assignedTo}
            </p>
            <p>
              <span className="text-gray-400">Fecha:</span>{' '}
              {mark.markedAt && formatDateTime(mark.markedAt)}
            </p>
          </div>

          {mark.note && (
            <div className="mt-2">
              <div className="text-xs text-gray-400 mb-1">Nota:</div>
              <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 p-2 rounded">
                {mark.note}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleUnmark}
          disabled={unmarking}
          className="ml-3 px-3 py-1.5 text-sm font-medium text-danger-700 bg-danger-50 rounded hover:bg-danger-100 disabled:opacity-50 transition-colors"
        >
          {unmarking ? '...' : '✕'}
        </button>
      </div>
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
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          mark.targetType === 'lead' 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {mark.targetType === 'lead' ? 'Lead' : 'Cliente'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleClick}
          className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
        >
          {mark.target?.name || `ID: ${mark.targetId}`}
        </button>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {mark.target?.status && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
            {mark.target.status}
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
          className="px-3 py-1.5 text-sm font-medium text-danger-700 bg-danger-50 rounded hover:bg-danger-100 disabled:opacity-50 transition-colors"
        >
          {unmarking ? 'Quitando...' : 'Quitar'}
        </button>
      </td>
    </tr>
  );
}
