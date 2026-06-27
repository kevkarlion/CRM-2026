'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteVersion {
  _id: string;
  quoteNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

interface Quote {
  _id: string;
  quoteNumber: string;
  client: { _id: string; name: string; email?: string } | string;
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
  createdBy?: string;
}

const STATUS_OPTIONS = [
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<Quote>(`/api/crm/quotes/${id}`);
        setQuote(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar cotización');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function loadVersions() {
    try {
      const data = await api.get<QuoteVersion[]>(`/api/crm/quotes/${id}/versions`);
      setVersions(data);
    } catch {
      // silently ignore
    }
  }

  function toggleVersions() {
    if (!showVersions) {
      loadVersions();
    }
    setShowVersions(!showVersions);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/crm/quotes/${id}`);
      router.push('/quotes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true);
    try {
      const updated = await api.patch<Quote>(`/api/crm/quotes/${id}/status`, { status: newStatus });
      setQuote(updated);
      setShowStatusMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleAction(action: string, endpoint: string) {
    setActionLoading(action);
    try {
      const updated = await api.post<Quote>(endpoint, {});
      setQuote(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${action}`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Cotización no encontrada</p>
        <button onClick={() => router.push('/quotes')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a cotizaciones
        </button>
      </div>
    );
  }

  const isConvertedOrCancelled = ['converted', 'cancelled'].includes(quote.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/quotes')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
            <p className="text-sm text-gray-500">{clientName(quote)}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[quote.status]}`}>
            {STATUS_OPTIONS.find((o) => o.value === quote.status)?.label || quote.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Información</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="# Cotización" value={quote.quoteNumber} />
              <DetailRow label="Cliente" value={clientName(quote)} />
              <DetailRow label="Válido Hasta" value={quote.validUntil ? formatDate(quote.validUntil) : '—'} />
              <DetailRow label="Creado" value={formatDate(quote.createdAt)} />
              <DetailRow label="Actualizado" value={formatDate(quote.updatedAt)} />
            </dl>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Descripción</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Precio Unit.</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>IVA (19%)</span>
                <span>{formatCurrency(quote.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {quote.terms && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Términos y Condiciones</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <button onClick={toggleVersions}
              className="flex items-center justify-between w-full text-left">
              <h2 className="text-base font-semibold text-gray-900">Historial de Versiones</h2>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${showVersions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showVersions && (
              <div className="mt-4 space-y-2">
                {versions.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin versiones registradas</p>
                ) : (
                  versions.map((v) => (
                    <div key={v._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{v.quoteNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(v.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[v.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_OPTIONS.find((o) => o.value === v.status)?.label || v.status}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(v.total)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>

            <button onClick={() => router.push(`/quotes/${id}/edit`)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Editar Cotización
            </button>

            {quote.status === 'draft' && (
              <button onClick={() => handleAction('enviar', `/api/crm/quotes/${id}/send`)} disabled={actionLoading === 'enviar'}
                className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {actionLoading === 'enviar' ? 'Enviando...' : 'Marcar como Enviado'}
              </button>
            )}

            {quote.status === 'sent' && (
              <button onClick={() => handleAction('aprobar', `/api/crm/quotes/${id}/approve`)} disabled={actionLoading === 'aprobar'}
                className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50 transition-colors">
                {actionLoading === 'aprobar' ? 'Aprobando...' : 'Aprobar'}
              </button>
            )}

            {quote.status === 'approved' && (
              <button onClick={() => handleAction('convertir', `/api/crm/quotes/${id}/convert`)} disabled={actionLoading === 'convertir'}
                className="w-full rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50 transition-colors">
                {actionLoading === 'convertir' ? 'Convirtiendo...' : 'Convertir a Contrato'}
              </button>
            )}

            <div className="relative">
              <button onClick={() => setShowStatusMenu(!showStatusMenu)} disabled={changingStatus}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {changingStatus ? 'Cambiando...' : 'Cambiar Estado'}
              </button>
              {showStatusMenu && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {STATUS_OPTIONS.filter((o) => o.value !== quote.status).map((opt) => (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-lg border border-danger-200 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors">
                Eliminar
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-danger-50 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">¿Eliminar esta cotización?</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 rounded-lg bg-danger-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-600 disabled:opacity-50 transition-colors">
                    {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
