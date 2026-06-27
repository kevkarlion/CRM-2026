'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface Lead {
  _id: string;
  name: string;
  companyName?: string;
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
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'disqualified', label: 'Descalificado' },
];

const STATUS_VARIANT: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  qualified: 'bg-warning-50 text-warning-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function assigneeName(lead: Lead): string {
  if (!lead.assignedTo) return '—';
  if (typeof lead.assignedTo === 'object') return lead.assignedTo.name;
  return lead.assignedTo;
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

      if (reset) {
        setLeads(result.data);
      } else {
        setLeads((prev) => [...prev, ...result.data]);
      }
      setCursor(result.cursor);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar leads');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, statusFilter, cursor]);

  useEffect(() => {
    fetchLeads(true);
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== undefined) fetchLeads(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function handleRowClick(id: string) {
    router.push(`/leads/${id}`);
  }

  function handleNew() {
    router.push('/leads/new');
  }

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
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as any).value)}
            placeholder="Buscar por nombre, empresa o email..."
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Origen</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Asignado</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Creado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => handleRowClick(lead._id)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{lead.name}</td>
                    <td className="px-5 py-3 text-gray-700">{lead.companyName || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.email || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{lead.source}</td>
                    <td className="px-5 py-3 text-gray-500">{assigneeName(lead)}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {leads.map((lead) => (
              <div
                key={lead._id}
                onClick={() => handleRowClick(lead._id)}
                className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    {lead.companyName && (
                      <p className="text-sm text-gray-500">{lead.companyName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                  <span className="capitalize">Origen: {lead.source}</span>
                  <span>Asignado: {assigneeName(lead)}</span>
                  <span>{formatDate(lead.createdAt)}</span>
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
