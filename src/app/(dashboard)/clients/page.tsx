'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { api, unwrapData } from '@/lib/api-client';
import { SOURCE_LABELS } from '@/leads/components/detail';
import { SearchInput } from '@/components/ui/SearchInput';

interface Client {
  _id: string;
  customerType: string;
  status: string;
  fullName?: string;
  companyName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  locality?: string;
  province?: string;
  source?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

interface ListResponse {
  data: Client[];
  cursor?: string;
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'prospect', label: 'Prospecto' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Bloqueado' },
];

const STATUS_VARIANT: Record<string, string> = {
  prospect: 'bg-brand-50 text-brand-700',
  active: 'bg-success-50 text-success-700',
  inactive: 'bg-gray-100 text-gray-700',
  blocked: 'bg-danger-50 text-danger-700',
};

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  residential: 'Residencial',
  commercial: 'Comercial',
  industrial: 'Industrial',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function clientName(client: Client): string {
  return client.companyName || client.fullName || '—';
}

function ViewClientLink({ clientId }: { clientId: string }) {
  return (
    <Link
      href={`/clients/${clientId}`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors cursor-pointer"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
      Ver
    </Link>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(false);

  const fetchClients = useCallback(async (reset = false) => {
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

      const result = await api.get<ListResponse>('/api/crm/clients', params);
      const clientsData = unwrapData<Client[]>(result);

      if (reset) {
        setClients(clientsData);
      } else {
        setClients((prev) => [...prev, ...clientsData]);
      }
      setCursor((result as any).cursor);
      setTotal((result as any).total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, statusFilter, cursor]);

  // Initial load + filter changes (debounced search) - prevents double-fetch with mountedRef
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchClients(true);
      return;
    }
    const timer = setTimeout(() => {
      fetchClients(true);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => clientName(a).localeCompare(clientName(b), 'es', { sensitivity: 'base' })),
    [clients],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} clientes encontrados` : 'Gestiona tus clientes'}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Cliente
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, empresa, email o teléfono..."
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as any).value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
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
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin clientes</h3>
          <p className="text-sm text-gray-500 mb-4">No hay clientes que coincidan con tu búsqueda</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs table-fixed">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-16 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                  <th className="w-28 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="w-28 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="w-20 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfono</th>
                  <th className="w-20 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="w-14 text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creado</th>
                  <th className="text-left px-1.5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Localidad</th>
                </tr>
              </thead>
              <tbody>
                {sortedClients.map((client, i) => (
                  <tr
                    key={client._id}
                    className={`transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-brand-50/40`}
                  >
                    <td className="px-1.5 py-1.5 text-left whitespace-nowrap">
                      <ViewClientLink clientId={client._id} />
                    </td>
                    <td className="px-1.5 py-1.5 text-xs font-medium text-gray-900 truncate">{clientName(client)}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-600 truncate">{client.fullName || '—'}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{client.phone || '—'}</td>
                    <td className="px-1.5 py-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[client.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_OPTIONS.find((o) => o.value === client.status)?.label || client.status}
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(client.createdAt)}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{client.locality || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {sortedClients.map((client) => (
              <div
                key={client._id}
                className="bg-white border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{clientName(client)}</p>
                    {client.companyName && client.fullName && (
                      <p className="text-sm text-gray-500">{client.fullName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[client.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_OPTIONS.find((o) => o.value === client.status)?.label || client.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.phone}</span>}
                  <span>{CUSTOMER_TYPE_LABEL[client.customerType] || client.customerType}</span>
                  {client.locality && <span>{client.locality}</span>}
                  <span>{formatDate(client.createdAt)}</span>
                </div>
                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {client.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                  <ViewClientLink clientId={client._id} />
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchClients(false)}
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
