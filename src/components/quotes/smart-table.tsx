'use client';

import type { QuoteTableRow } from '@/quotes/types/client-quote-types';

interface SmartTableProps {
  rows: QuoteTableRow[];
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}

// Anchos determinísticos por columna — evita hydration mismatch por Math.random()
const SKELETON_WIDTHS = ['80%', '55%', '70%', '60%', '75%', '65%', '50%'];

function SkeletonRow() {
  return (
    <tr>
      {SKELETON_WIDTHS.map((width, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width }} />
        </td>
      ))}
    </tr>
  );
}

export function SmartTable({ rows, loading, error, onRetry, children }: SmartTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50/80">
          <tr>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
            <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Vencimiento</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Asignado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : error ? (
            <tr>
              <td colSpan={7} className="px-2 py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-red-600">{error}</p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-6 text-center text-xs text-gray-400">
                No hay cotizaciones o negociaciones
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
