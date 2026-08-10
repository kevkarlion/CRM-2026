'use client';

import type { ClientDetail } from './client-detail.types';
import { blockUserName, formatLongDate } from './client-detail.constants';

interface ClientBlockHistoryCardProps {
  client: ClientDetail;
  onBlock?: () => void;
  onUnblock?: () => void;
  isBlocked?: boolean;
  loading?: boolean;
}

export function ClientBlockHistoryCard({ 
  client, 
  onBlock, 
  onUnblock, 
  isBlocked = false,
  loading = false 
}: ClientBlockHistoryCardProps) {
  const entries = client.blockHistory || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Historial de bloqueos</h2>
        
        {client.status === 'blocked' ? (
          <button
            onClick={onUnblock}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-success-200 bg-success-50 text-success-700 hover:bg-success-100 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Desbloquear
          </button>
        ) : onBlock ? (
          <button
            onClick={onBlock}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Bloquear
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">Sin bloqueos registrados</p>
      ) : (
        <ul className="space-y-3">
          {[...entries].reverse().map((entry, idx) => (
            <li key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">{entry.reason}</p>
              <p className="mt-2 text-xs text-gray-500">
                <span className="text-danger-600">Bloqueado:</span> {formatLongDate(entry.blockedAt)}
                {entry.blockedBy && <> por {blockUserName(entry.blockedBy)}</>}
              </p>
              {entry.unblockedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  <span className="text-success-600">Desbloqueado:</span> {formatLongDate(entry.unblockedAt)}
                  {entry.unblockedBy && <> por {blockUserName(entry.unblockedBy)}</>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
