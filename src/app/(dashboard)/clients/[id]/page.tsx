'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { api, unwrapData } from '@/lib/api-client';
import { EntityDetailLayout, EntityTab, EntityTabPanel, EntityTabs } from '@/components/entity-detail';
import {
  ClientBlockHistoryCard,
  ClientConfirmSaleDrawer,
  ClientDocumentationTab,
  ClientInfoCard,
  ClientMetadataCard,
  ClientNotesCard,
  ClientQuotesTab,
  ClientVisitsTab,
  ClientWorkOrdersTab,
  ClientActivityTab,
  CLIENT_STATUS_DOT_COLOR,
  CLIENT_STATUS_OPTIONS,
  CLIENT_STATUS_VARIANT,
  CUSTOMER_TYPE_LABEL,
  clientName,
} from '@/crm/components/detail';
import { LeadCommercialActionsCard, LeadBotControlCard } from '@/leads/components/detail';
import { CreateQuoteDrawer } from '@/leads/components/CreateQuoteDrawer';
import { CreateVisitDrawer } from '@/leads/components/CreateVisitDrawer';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import type { ClientDetail, QuoteListItem } from '@/crm/components/detail';

type DetailTabId = 'resumen' | 'presupuestos' | 'ordenes' | 'visitas' | 'documentacion' | 'actividad';

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

  // Block / unblock flow
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Commercial actions drawers
  const [showQuoteDrawer, setShowQuoteDrawer] = useState(false);
  const [showVisitDrawer, setShowVisitDrawer] = useState(false);
  const [showConfirmSaleDrawer, setShowConfirmSaleDrawer] = useState(false);

  // Chat state
  const [activeDetailTab, setActiveDetailTab] = useState<'chat' | 'timeline'>('chat');
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const phone = client?.phone || null;
  const {
    messages,
    loading: chatLoading,
    error: chatError,
    hasMore,
    loadMore,
    refetch: refetchChat,
  } = useChatMessages(phone);
  const { sendMessage, sendMedia, downloadMedia, sending: chatSending } = useWhatsAppSend();

  useChatPolling({
    interval: 5000,
    enabled: activeDetailTab === 'chat',
    onPoll: refetchChat,
  });

  const handleSendChat = useCallback(async (content: string) => {
    if (!phone) return;
    await sendMessage({ phone, content });
    refetchChat();
  }, [phone, sendMessage, refetchChat]);

  const handleAttachChat = useCallback(async (file: File) => {
    if (!phone) return;
    await sendMedia({
      file,
      to: phone,
      clientId: id,
    });
    refetchChat();
  }, [phone, sendMedia, id, refetchChat]);

  const handleDownloadChat = useCallback(async (messageId: string, filename: string) => {
    if (!phone) return;
    const result = await downloadMedia({
      messageId,
      filename,
      clientId: id,
    });
    if (result.success) {
      refetchChat();
    }
  }, [phone, downloadMedia, id, refetchChat]);

  // Bot control state (same as lead)
  const [conversation, setConversation] = useState<any>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch conversation for bot control
  useEffect(() => {
    if (!id || !phone) return;

    const fetchConversation = async () => {
      setLoadingConversation(true);
      try {
        // For clients, we need a different endpoint or use the general one
        const res = await api.get<{ conversation: any }>(
          `/api/crm/conversations/by-phone/${phone}`,
        );
        setConversation(res.conversation);
      } catch (conversationError) {
        console.error('Error fetching conversation:', conversationError);
      } finally {
        setLoadingConversation(false);
      }
    };

    fetchConversation();
  }, [id, phone]);

  const handleTakeControl = async () => {
    if (!conversation?._id) return;
    setActionLoading(true);
    try {
      await api.post(`/api/crm/conversations/${conversation._id}/take-control`, {});
      setConversation((prev: any) =>
        prev ? { ...prev, owner: 'OPERATOR', lifecycleState: 'IN_PROGRESS' } : null,
      );
    } catch (err) {
      console.error('Error taking control:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!conversation?._id) return;
    setActionLoading(true);
    try {
      await api.post(`/api/crm/conversations/${conversation._id}/resolve`, {});
      setConversation((prev: any) =>
        prev
          ? {
              ...prev,
              owner: 'OPERATOR',
              lifecycleState: 'RESOLVED',
              resolvedAt: new Date().toISOString(),
            }
          : null,
      );
    } catch (err) {
      console.error('Error marking resolved:', err);
    } finally {
      setActionLoading(false);
    }
  };

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

  async function refreshClient() {
    try {
      const data = await api.get<ClientDetail>(`/api/crm/clients/${id}`);
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cliente');
    }
  }

  function closeBlockModal() {
    if (submitting) return;
    setBlockModalOpen(false);
    setBlockReason('');
    setActionError(null);
  }

  function closeUnblockModal() {
    if (submitting) return;
    setUnblockModalOpen(false);
    setActionError(null);
  }

  async function handleBlock() {
    if (!blockReason.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/crm/clients/${id}/block`, { reason: blockReason.trim() });
      setBlockModalOpen(false);
      setBlockReason('');
      await refreshClient();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al bloquear cliente');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock() {
    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/crm/clients/${id}/unblock`, {});
      setUnblockModalOpen(false);
      await refreshClient();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al desbloquear cliente');
    } finally {
      setSubmitting(false);
    }
  }

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
    <>
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
            <EntityTab id="actividad" label="Actividad" />

<EntityTabPanel id="resumen">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-6 lg:col-span-2">
                    <ClientInfoCard client={client} />
                    <ClientNotesCard notes={client.notes} />
                    <ClientBlockHistoryCard client={client} />
                  </div>

                  <aside className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>
                      <Link
                        href={`/clients/${id}/edit`}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                      >
                        Editar Cliente
                      </Link>
                      {client.status !== 'blocked' && (
                        <button
                          onClick={() => setBlockModalOpen(true)}
                          className="w-full inline-flex items-center justify-center rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger-700 hover:bg-danger-100 transition-colors"
                        >
                          Bloquear Cliente
                        </button>
                      )}
                      {client.status === 'blocked' && (
                        <button
                          onClick={() => setUnblockModalOpen(true)}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-success-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-success-700 transition-colors"
                        >
                          Desbloquear Cliente
                        </button>
                      )}
                    </div>
                    <LeadCommercialActionsCard
                      onOpenQuoteDrawer={() => setShowQuoteDrawer(true)}
                      onOpenVisitDrawer={() => setShowVisitDrawer(true)}
                      onOpenQuickSaleDrawer={() => setShowConfirmSaleDrawer(true)}
                      disabled={client.status === 'blocked'}
                    />
                    <ClientMetadataCard client={client} />
                  </aside>
                </div>

                {/* Chat + Bot Control - full width, same proportions as lead */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-3">
                    <EntityTabs
                      activeId={activeDetailTab}
                      onChange={(id) => setActiveDetailTab(id as 'chat' | 'timeline')}
                      aria-label="Comunicación y actividad del cliente"
                    >
                      <EntityTab id="chat" label="Chat WhatsApp" />
                      <EntityTab id="timeline" label="Actividad" />

                      <EntityTabPanel id="chat" className="h-[500px] p-0">
                        <ChatPanel
                          messages={messages}
                          loading={chatLoading}
                          error={chatError}
                          hasMore={hasMore}
                          onLoadMore={loadMore}
                          onSend={handleSendChat}
                          onAttach={handleAttachChat}
                          onDownload={handleDownloadChat}
                          sending={chatSending}
                          selectedPhone={phone}
                          clientId={id}
                        />
                      </EntityTabPanel>

                      <EntityTabPanel id="timeline" className="p-6">
                        <ClientActivityTab clientId={id} />
                      </EntityTabPanel>
                    </EntityTabs>
                  </div>
                  <div className="lg:col-span-1">
                    <LeadBotControlCard
                      conversation={conversation}
                      loading={loadingConversation}
                      actionLoading={actionLoading}
                      onTakeControl={handleTakeControl}
                      onMarkResolved={handleMarkResolved}
                    />
                  </div>
                </div>
              </div>
            </EntityTabPanel>

            <EntityTabPanel id="presupuestos">
              <ClientQuotesTab quotes={quotes} loading={loadingQuotes} />
            </EntityTabPanel>

            <EntityTabPanel id="ordenes">
              <ClientWorkOrdersTab clientId={id} />
            </EntityTabPanel>

            <EntityTabPanel id="visitas">
              <ClientVisitsTab clientId={id} />
            </EntityTabPanel>

            <EntityTabPanel id="documentacion">
              <ClientDocumentationTab clientId={id} />
            </EntityTabPanel>

            <EntityTabPanel id="actividad">
              <ClientActivityTab clientId={id} />
            </EntityTabPanel>
          </EntityTabs>
        </div>
      </EntityDetailLayout>

      {blockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Bloquear Cliente</h2>
            <p className="text-sm text-gray-500 mb-4">
              El cliente dejará de operar en el CRM hasta que sea desbloqueado.
            </p>

            {actionError && (
              <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del bloqueo <span className="text-danger-500">*</span>
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none min-h-[80px]"
                placeholder="Describe el motivo del bloqueo"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleBlock}
                disabled={submitting || !blockReason.trim()}
                className="rounded-lg bg-danger-500 px-5 py-2 text-sm font-medium text-white hover:bg-danger-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Bloqueando...' : 'Bloquear Cliente'}
              </button>
              <button
                type="button"
                onClick={closeBlockModal}
                disabled={submitting}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {unblockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Desbloquear Cliente</h2>
            <p className="text-sm text-gray-500 mb-4">
              ¿Estás seguro de desbloquear a este cliente? Volverá a estar activo en el CRM.
            </p>

            {actionError && (
              <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 mb-4">
                {actionError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleUnblock}
                disabled={submitting}
                className="rounded-lg bg-success-600 px-5 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Desbloqueando...' : 'Desbloquear'}
              </button>
              <button
                type="button"
                onClick={closeUnblockModal}
                disabled={submitting}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateQuoteDrawer
        isOpen={showQuoteDrawer}
        onClose={() => setShowQuoteDrawer(false)}
        clientId={id}
        clientName={name}
        onSuccess={refreshClient}
      />

      <CreateVisitDrawer
        isOpen={showVisitDrawer}
        onClose={() => setShowVisitDrawer(false)}
        clientId={id}
        clientName={name}
        clientPhone={client.phone}
        clientEmail={client.email}
        onSuccess={refreshClient}
      />

      <ClientConfirmSaleDrawer
        isOpen={showConfirmSaleDrawer}
        onClose={() => setShowConfirmSaleDrawer(false)}
        clientId={id}
        clientName={name}
        onSuccess={refreshClient}
      />
    </>
  );
}
