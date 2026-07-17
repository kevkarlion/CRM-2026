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
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
            <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">Vencimiento</th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Próxima Acción</th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">Asignado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : error ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-red-600">{error}</p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="rounded bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
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
