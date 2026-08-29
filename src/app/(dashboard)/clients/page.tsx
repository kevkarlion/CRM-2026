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
  profileName?: string;
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

const STATUS_VARIANT_MOBILE: Record<string, string> = {
  prospect: 'bg-sky-600 text-white',
  active: 'bg-emerald-700 text-white',
  inactive: 'bg-gray-200 text-gray-800',
  blocked: 'bg-rose-600 text-white',
};

const STATUS_ACCENT_MOBILE: Record<string, string> = {
  prospect: 'border-l-sky-500',
  active: 'border-l-emerald-500',
  inactive: 'border-l-gray-300',
  blocked: 'border-l-rose-500',
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
  return (client as any).profileName || client.companyName || client.fullName || '—';
}

function ViewClientLink({ clientId }: { clientId: string }) {
  return (
    <Link
      href={`/clients/${clientId}`}
      className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
    >
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                  <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="min-w-[80px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Creado</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Localidad</th>
                </tr>
              </thead>
              <tbody>
                {sortedClients.map((client, i) => (
                  <tr
                    key={client._id}
                    className={`border-b border-gray-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-brand-50/40`}
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap align-middle">
                      <ViewClientLink clientId={client._id} />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">{clientName(client)}</td>
                    <td className="px-2 py-1.5 text-gray-600 align-middle">{client.fullName || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-500 align-middle">{client.phone || '—'}</td>
                    <td className="px-2 py-1.5 align-middle">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${STATUS_VARIANT[client.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_OPTIONS.find((o) => o.value === client.status)?.label || client.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap align-middle">{formatDate(client.createdAt)}</td>
                    <td className="px-2 py-1.5 text-gray-500 align-middle">{client.locality || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {sortedClients.map((client) => (
              <div
                key={client._id}
                className={`bg-white border border-gray-200 border-l-4 rounded-xl p-4 shadow-sm space-y-3 ${STATUS_ACCENT_MOBILE[client.status] || 'border-l-gray-300'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{clientName(client)}</p>
                    {client.companyName && client.fullName && (
                      <p className="text-sm text-gray-500 truncate">{client.fullName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT_MOBILE[client.status] || 'bg-gray-200 text-gray-800'}`}>
                    {STATUS_OPTIONS.find((o) => o.value === client.status)?.label || client.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {client.email && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Email</span>
                      <span className="block text-sm font-medium text-gray-900 truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Teléfono</span>
                      <span className="block text-sm font-medium text-gray-900">{client.phone}</span>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tipo</span>
                    <span className="block text-sm font-medium text-gray-900">{CUSTOMER_TYPE_LABEL[client.customerType] || client.customerType}</span>
                  </div>
                  {client.locality && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Localidad</span>
                      <span className="block text-sm font-medium text-gray-900 truncate">{client.locality}</span>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Creado</span>
                    <span className="block text-sm font-medium text-gray-900">{formatDate(client.createdAt)}</span>
                  </div>
                </div>
                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {client.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-end border-t border-gray-100 pt-3">
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
