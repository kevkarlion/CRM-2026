'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { api, unwrapData } from '@/lib/api-client';
import { EntityDetailLayout, EntityTab, EntityTabPanel, EntityTabs } from '@/components/entity-detail';
import {
  ClientDocumentationTab,
  ClientInfoCard,
  ClientMetadataCard,
  ClientNotesCard,
  ClientQuotesTab,
  ClientVisitsTab,
  ClientWorkOrdersTab,
  CLIENT_STATUS_DOT_COLOR,
  CLIENT_STATUS_OPTIONS,
  CLIENT_STATUS_VARIANT,
  CUSTOMER_TYPE_LABEL,
  clientName,
} from '@/crm/components/detail';
import type { ClientDetail, QuoteListItem } from '@/crm/components/detail';

type DetailTabId = 'resumen' | 'presupuestos' | 'ordenes' | 'visitas' | 'documentacion';

function isNotFoundError(message: string): boolean {
  return /not found/i.test(message);
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Entity tabs
  const [activeTab, setActiveTab] = useState<DetailTabId>('resumen');

  // Quotes fetched by clientId through the existing /api/crm/quotes endpoint
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const quotesLoadedRef = useRef(false);

  const loadClient = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<ClientDetail>(`/api/crm/clients/${id}`);
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cliente');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  async function loadQuotes() {
    setLoadingQuotes(true);
    try {
      const res = await api.get<{ data: QuoteListItem[] }>('/api/crm/quotes', {
        clientId: id,
        limit: '50',
      });
      setQuotes(unwrapData<QuoteListItem[]>(res));
      quotesLoadedRef.current = true;
    } catch (err) {
      console.error('Error loading client quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  }

  function handleTabChange(nextId: string) {
    setActiveTab(nextId as DetailTabId);

    // Lazily load quotes the first time the tab is opened.
    if (nextId === 'presupuestos' && !quotesLoadedRef.current) {
      loadQuotes();
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

  if (error) {
    if (isNotFoundError(error)) {
      return (
        <div className="text-center py-16">
          <p className="text-gray-500">Cliente no encontrado</p>
          <button
            onClick={() => router.push('/clients')}
            className="mt-4 text-sm text-brand-600 font-medium"
          >
            Volver a clientes
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
        <p>{error}</p>
        <button
          onClick={loadClient}
          className="mt-2 text-sm font-semibold text-danger-700 underline hover:text-danger-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Cliente no encontrado</p>
        <button
          onClick={() => router.push('/clients')}
          className="mt-4 text-sm text-brand-600 font-medium"
        >
          Volver a clientes
        </button>
      </div>
    );
  }

  const name = clientName(client);

  return (
    <EntityDetailLayout
      backHref="/clients"
      backLabel="Volver a clientes"
      title={name}
      subtitle={client.companyName && client.fullName ? client.fullName : client.email}
      badges={
        <>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${
              CLIENT_STATUS_VARIANT[client.status] || 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${CLIENT_STATUS_DOT_COLOR[client.status] || 'bg-gray-400'}`} />
            {CLIENT_STATUS_OPTIONS.find((o) => o.value === client.status)?.label || client.status}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border bg-gray-50 border-gray-200 text-gray-600">
            {CUSTOMER_TYPE_LABEL[client.customerType] || client.customerType}
          </span>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <EntityTabs
          activeId={activeTab}
          onChange={handleTabChange}
          aria-label="Detalle del cliente"
        >
          <EntityTab id="resumen" label="Resumen" />
          <EntityTab id="presupuestos" label="Presupuestos" count={quotes.length} />
          <EntityTab id="ordenes" label="Órdenes de trabajo" />
          <EntityTab id="visitas" label="Visitas técnicas" />
          <EntityTab id="documentacion" label="Documentación" />

          <EntityTabPanel id="resumen">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <ClientInfoCard client={client} />
                <ClientNotesCard notes={client.notes} />
              </div>

              <aside className="space-y-4">
                <ClientMetadataCard client={client} />
              </aside>
            </div>
          </EntityTabPanel>

          <EntityTabPanel id="presupuestos">
            <ClientQuotesTab quotes={quotes} loading={loadingQuotes} />
          </EntityTabPanel>

          <EntityTabPanel id="ordenes">
            <ClientWorkOrdersTab />
          </EntityTabPanel>

          <EntityTabPanel id="visitas">
            <ClientVisitsTab />
          </EntityTabPanel>

          <EntityTabPanel id="documentacion">
            <ClientDocumentationTab />
          </EntityTabPanel>
        </EntityTabs>
      </div>
    </EntityDetailLayout>
  );
}
