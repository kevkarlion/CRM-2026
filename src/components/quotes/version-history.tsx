'use client';

import { formatDateShort } from '@/lib/format-date';

interface VersionHistoryProps {
  versions: any[];
  loading: boolean;
  showVersions: boolean;
  onToggle: () => void;
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

export function VersionHistory({ versions, loading, showVersions, onToggle }: VersionHistoryProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-base font-semibold text-gray-900">Historial de Versiones</h2>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${showVersions ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showVersions && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin versiones registradas</p>
          ) : (
            versions.map((v: any) => (
              <div key={v._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">Versión {v.version}</p>
                  <p className="text-xs text-gray-500">{formatDateShort(v.createdAt)}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatCLP(v.total)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
