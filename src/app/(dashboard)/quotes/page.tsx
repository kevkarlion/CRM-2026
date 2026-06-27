'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quote {
  _id: string;
  quoteNumber: string;
  client: { _id: string; name: string } | string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  validUntil: string;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: Quote[];
  cursor?: string;
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'expired', label: 'Expirado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-success-50 text-success-700',
  rejected: 'bg-danger-50 text-danger-700',
  converted: 'bg-purple-50 text-purple-700',
  expired: 'bg-yellow-50 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function clientName(quote: Quote): string {
  if (!quote.client) return '—';
  if (typeof quote.client === 'object') return quote.client.name;
  return quote.client;
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchQuotes = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setCursor(undefined);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params: Record<string, string> = { limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (!reset && cursor) params.cursor = cursor;

      const result = await api.get<ListResponse>('/api/crm/quotes', params);

      if (reset) {
        setQuotes(result.data);
      } else {
        setQuotes((prev) => [...prev, ...result.data]);
      }
      setCursor(result.cursor);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, statusFilter, cursor]);

  useEffect(() => {
    fetchQuotes(true);
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== undefined) fetchQuotes(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function handleRowClick(id: string) {
    router.push(`/quotes/${id}`);
  }

  function handleNew() {
    router.push('/quotes/new');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} cotizaciones encontradas` : 'Gestiona tus cotizaciones'}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cotización
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as any).value)}
            placeholder="Buscar por número o cliente..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as any).value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin cotizaciones</h3>
          <p className="text-sm text-gray-500 mb-4">No hay cotizaciones que coincidan con tu búsqueda</p>
          <button onClick={handleNew} className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Crear primera cotización
          </button>
        </div>
      ) : (
        <>
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600"># Cotización</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Válido Hasta</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Creado</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr
                    key={quote._id}
                    onClick={() => handleRowClick(quote._id)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{quote.quoteNumber}</td>
                    <td className="px-5 py-3 text-gray-700">{clientName(quote)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(quote.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[quote.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_OPTIONS.find((o) => o.value === quote.status)?.label || quote.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{quote.validUntil ? formatDate(quote.validUntil) : '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(quote.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {quotes.map((quote) => (
              <div
                key={quote._id}
                onClick={() => handleRowClick(quote._id)}
                className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{quote.quoteNumber}</p>
                    <p className="text-sm text-gray-500">{clientName(quote)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[quote.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_OPTIONS.find((o) => o.value === quote.status)?.label || quote.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span className="font-medium text-gray-700">{formatCurrency(quote.total)}</span>
                  {quote.validUntil && <span>Válido: {formatDate(quote.validUntil)}</span>}
                  <span>{formatDate(quote.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchQuotes(false)}
                disabled={loadingMore}
                className="rounded-lg border border-gray-200 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
