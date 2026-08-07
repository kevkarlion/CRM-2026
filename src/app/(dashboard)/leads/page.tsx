'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, unwrapData } from '@/lib/api-client';
import { LEAD_STATUS_LABELS } from '@/leads/constants/lead-status.constants';
import { SOURCE_LABELS } from '@/leads/components/detail';
import { SearchInput } from '@/components/ui/SearchInput';

interface Lead {
  _id: string;
  name: string;
  companyName?: string;
  profileName?: string;
  locality?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  assignedTo?: { _id: string; name: string; email: string } | string;
  createdAt: string;
}

interface ListResponse {
  data: Lead[];
  cursor?: string;
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(LEAD_STATUS_LABELS)
    .filter(([value]) => value !== 'disqualified')
    .map(([value, label]) => ({ value, label })),
];

const STATUS_VARIANT: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  quote_sent: 'bg-blue-50 text-blue-700',
  technical_visit: 'bg-purple-50 text-purple-700',
  negotiation: 'bg-warning-50 text-warning-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

function statusLabel(status: string): string {
  return (LEAD_STATUS_LABELS as Record<string, string>)[status] || status;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function assigneeName(lead: Lead): string {
  if (!lead.assignedTo) return '—';
  if (typeof lead.assignedTo === 'object') return lead.assignedTo.name;
  return lead.assignedTo;
}

function ViewLeadLink({ leadId }: { leadId: string }) {
  return (
    <Link
      href={`/leads/${leadId}`}
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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(false);

  const fetchLeads = useCallback(async (reset = false) => {
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

      const result = await api.get<ListResponse>('/api/crm/leads', params);
      const leadsData = unwrapData<Lead[]>(result);

      if (reset) {
        setLeads(leadsData);
      } else {
        setLeads((prev) => [...prev, ...leadsData]);
      }
      setCursor((result as any).cursor);
      setTotal((result as any).total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar leads');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, statusFilter, cursor]);

  // Initial load + filter changes (debounced search) - prevents double-fetch with mountedRef
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchLeads(true);
      return;
    }
    const timer = setTimeout(() => {
      fetchLeads(true);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  function handleNew() {
    router.push('/leads/new');
  }

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [leads],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} leads encontrados` : 'Gestiona tus prospectos'}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Lead
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, empresa o email..."
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
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin leads</h3>
          <p className="text-sm text-gray-500 mb-4">No hay leads que coincidan con tu búsqueda</p>
          <button onClick={handleNew} className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Crear primer lead
          </button>
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
                {sortedLeads.map((lead, i) => (
                  <tr
                    key={lead._id}
                    className={`transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-brand-50/40`}
                  >
                    <td className="px-1.5 py-1.5 text-left whitespace-nowrap">
                      <ViewLeadLink leadId={lead._id} />
                    </td>
                    <td className="px-1.5 py-1.5 text-xs font-medium text-gray-900 truncate">{lead.companyName || lead.profileName || '—'}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-600 truncate">{lead.name}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{lead.phone || '—'}</td>
                    <td className="px-1.5 py-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(lead.createdAt)}</td>
                    <td className="px-1.5 py-1.5 text-xs text-gray-500 truncate">{lead.locality || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {sortedLeads.map((lead) => (
              <div
                key={lead._id}
                className="bg-white border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    {lead.companyName && (
                      <p className="text-sm text-gray-500">{lead.companyName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabel(lead.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                  <span className="capitalize">Origen: {lead.source}</span>
                  <span>Asignado: {assigneeName(lead)}</span>
                  <span>{formatDate(lead.createdAt)}</span>
                </div>
                <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                  <ViewLeadLink leadId={lead._id} />
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchLeads(false)}
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
