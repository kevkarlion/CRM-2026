'use client';

import type { ClientDetail } from './client-detail.types';
import { blockUserName, formatLongDate } from './client-detail.constants';

interface ClientBlockHistoryCardProps {
  client: ClientDetail;
}

export function ClientBlockHistoryCard({ client }: ClientBlockHistoryCardProps) {
  const entries = client.blockHistory || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Historial de bloqueos</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">Sin bloqueos registrados</p>
      ) : (
        <ul className="space-y-3">
          {[...entries].reverse().map((entry, idx) => (
            <li key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{entry.reason}</p>
              <p className="mt-1 text-xs text-gray-500">
                Bloqueado el {formatLongDate(entry.blockedAt)} por {blockUserName(entry.blockedBy)}
                {entry.unblockedAt && (
                  <>
                    {' · '}
                    Desbloqueado el {formatLongDate(entry.unblockedAt)} por{' '}
                    {blockUserName(entry.unblockedBy)}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
