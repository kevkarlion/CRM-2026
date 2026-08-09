'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { EntityDetailLayout, EntityTab, EntityTabPanel, EntityTabs } from '@/components/entity-detail';
import { LeadTimeline } from '@/activity/components/LeadTimeline';
import {
  LeadActivityTabs,
  LeadAdminNotesCard,
  LeadBotControlCard,
  LeadCommercialActionsCard,
  LeadDocumentationTab,
  LeadEditActionCard,
  LeadInfoCard,
  LeadQuotesTab,
  LeadSummaryNoteCard,
  LeadVisitsTab,
  LeadWorkOrdersTab,
  STATUS_DOT_COLOR,
  STATUS_OPTIONS,
  STATUS_VARIANT,
} from '@/leads/components/detail';
import type {
  ConversationDetail,
  LeadDetail,
  QuoteListItem,
  SaleDetail,
  VisitListItem,
  WorkOrderListItem,
} from '@/leads/components/detail';
import { CreateQuoteDrawer } from '@/leads/components/CreateQuoteDrawer';
import { CreateVisitDrawer } from '@/leads/components/CreateVisitDrawer';
import { QuoteDetailDrawer } from '@/leads/components/QuoteDetailDrawer';
import { QuickSaleDrawer } from '@/leads/components/QuickSaleDrawer';
import { useConversationStatus } from '@/leads/pipeline-board/hooks/useConversationStatus';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';

type DetailTabId = 'resumen' | 'presupuestos' | 'ordenes' | 'visitas' | 'documentacion' | 'actividad';

function isContactedStatus(status: string): boolean {
  return status === 'contacted' || status === 'quote_sent' || status === 'technical_visit';
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Entity tabs
  const [activeTab, setActiveTab] = useState<DetailTabId>('resumen');
  const [activeDetailTab, setActiveDetailTab] = useState<'chat' | 'timeline'>('chat');

  // Drawer states
  const [showQuoteDrawer, setShowQuoteDrawer] = useState(false);
  const [showVisitDrawer, setShowVisitDrawer] = useState(false);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showQuickSaleDrawer, setShowQuickSaleDrawer] = useState(false);

  // Quote sending state
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  // Related lists (quotes / technical visits)
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const relatedLoadedRef = useRef(false);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // Sale detail for converted leads
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);

  // Conversation state for bot ↔ operator handoff
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Chat state
  const phone = lead?.phone || null;
  const {
    messages,
    loading: chatLoading,
    error: chatError,
    hasMore,
    loadMore,
    refetch: refetchChat,
  } = useChatMessages(phone);
  const { sendMessage, sendMedia, sending: chatSending } = useWhatsAppSend();
  const { statusMap } = useConversationStatus([id]);
  const conversationStatus = statusMap.get(id) || null;

  useChatPolling({
    interval: 5000,
    enabled: activeDetailTab === 'chat',
    onPoll: refetchChat,
  });

  // Fetch conversation (bot ↔ operator handoff)
  useEffect(() => {
    if (!id) return;

    const fetchConversation = async () => {
      setLoadingConversation(true);
      try {
        const res = await api.get<{ conversation: ConversationDetail }>(
          `/api/crm/conversations/by-lead/${id}`,
        );
        setConversation(res.conversation);
      } catch (conversationError) {
        console.error('Error fetching conversation:', conversationError);
      } finally {
        setLoadingConversation(false);
      }
    };

    fetchConversation();
  }, [id]);

  // Load lead detail
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<LeadDetail>(`/api/crm/leads/${id}`);
        setLead(data);

        if (isContactedStatus(data.status)) {
          loadRelatedData();
        }

        if (data.convertedToClient || data.convertedToWorkOrder) {
          loadSaleDetail();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar lead');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function loadRelatedData() {
    setLoadingRelated(true);
    try {
      const [quotesData, visitsData] = await Promise.all([
        api.get<QuoteListItem[]>(`/api/crm/leads/${id}/quotes`),
        api.get<VisitListItem[]>(`/api/crm/leads/${id}/visits`).catch(() => []),
      ]);
      setQuotes(quotesData);
      setVisits(visitsData);
      relatedLoadedRef.current = true;
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }

  async function loadSaleDetail() {
    setLoadingSaleDetail(true);
    try {
      const data = await api.get<SaleDetail>(`/api/crm/leads/${id}/sale-detail`);
      setSaleDetail(data);
    } catch (err) {
      console.error('Error loading sale detail:', err);
    } finally {
      setLoadingSaleDetail(false);
    }
  }

  function handleTabChange(nextId: string) {
    setActiveTab(nextId as DetailTabId);

    // Lazily load related data the first time a tab that needs it is opened.
    if ((nextId === 'presupuestos' || nextId === 'visitas') && !relatedLoadedRef.current) {
      loadRelatedData();
    }
  }

  async function saveNotes(value: string) {
    try {
      const updated = await api.patch<LeadDetail>(`/api/crm/leads/${id}`, {
        adminNotes: value,
      });
      setLead(updated);
    } catch (err) {
      console.error('Error saving notes:', err);
      throw err;
    }
  }

  const handleSendChat = async (content: string) => {
    if (!lead?.phone) return;
    const result = await sendMessage({
      phone: lead.phone,
      content,
      leadId: id,
    });
    if (result) {
      refetchChat();
    }
  };

  const handleAttachChat = async (file: File) => {
    if (!lead?.phone) return;
    const result = await sendMedia({
      file,
      to: lead.phone,
      leadId: id,
    });
    if (result) {
      refetchChat();
    }
  };

  const handleTakeControl = async () => {
    if (!conversation?._id) return;

    setActionLoading(true);
    try {
      console.log('[LeadDetail] Taking control of conversation:', conversation._id);
      const res = await api.post<{ success: boolean }>(
        `/api/crm/conversations/${conversation._id}/take-control`, 
        {}
      );
      console.log('[LeadDetail] Take control response:', res);
      
      setConversation((prev) =>
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
      console.log('[LeadDetail] Resolving conversation:', conversation._id);
      const res = await api.post<{ success: boolean }>(
        `/api/crm/conversations/${conversation._id}/resolve`, 
        {}
      );
      console.log('[LeadDetail] Resolve response:', res);
      
      setConversation((prev) =>
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

  async function handleSendQuote(quoteId: string) {
    setSendingQuoteId(quoteId);
    try {
      await api.post(`/api/crm/quotes/${quoteId}/send`, {});
      await loadRelatedData();
      const refreshed = await api.get<LeadDetail>(`/api/crm/leads/${id}`);
      setLead(refreshed);
      setTimelineRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar presupuesto');
    } finally {
      setSendingQuoteId(null);
    }
  }

  function handleViewQuoteDetail(quoteId: string) {
    setSelectedQuoteId(quoteId);
    setShowQuoteDetail(true);
  }

  const refreshLeadAndTimeline = () => {
    api.get<LeadDetail>(`/api/crm/leads/${id}`).then(setLead);
    loadRelatedData();
    setTimelineRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Lead no encontrado</p>
        <button
          onClick={() => router.push('/leads')}
          className="mt-4 text-sm text-brand-600 font-medium"
        >
          Volver a leads
        </button>
      </div>
    );
  }

  const isConverted = !!lead.convertedToClient;
  const isContacted = isContactedStatus(lead.status);
  const canCreateQuoteOrVisit = isContacted && !isConverted;
  const workOrders: WorkOrderListItem[] =
    saleDetail?.hasSale && saleDetail.workOrder ? [saleDetail.workOrder] : [];

  return (
    <EntityDetailLayout
      backHref="/leads"
      backLabel="Volver a leads"
      title={lead.name}
      subtitle={lead.companyName}
      badges={
        <>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${
              STATUS_VARIANT[lead.status] || 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLOR[lead.status] || 'bg-gray-400'}`} />
            {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
          </span>
          {isConverted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border bg-green-50 border-green-200 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Convertido
            </span>
          )}
        </>
      }
    >
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <EntityTabs
          activeId={activeTab}
          onChange={handleTabChange}
          aria-label="Detalle del lead"
        >
          <EntityTab id="resumen" label="Resumen" />
          <EntityTab id="presupuestos" label="Presupuestos" count={quotes.length} />
          <EntityTab id="ordenes" label="Órdenes de trabajo" count={workOrders.length} />
          <EntityTab id="visitas" label="Visitas técnicas" count={visits.length} />
          <EntityTab id="documentacion" label="Documentación" />
          <EntityTab id="actividad" label="Actividad" />

          <EntityTabPanel id="resumen">
            <div className="space-y-6">
              <LeadInfoCard
                lead={lead}
                isConverted={isConverted}
                saleDetail={saleDetail}
                loadingSaleDetail={loadingSaleDetail}
                onViewQuote={handleViewQuoteDetail}
              />
              <LeadSummaryNoteCard notes={lead.notes} />
              <LeadAdminNotesCard notes={lead.adminNotes} onSave={saveNotes} />

              {/* Chat + Bot Control - side by side on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3">
                  <LeadActivityTabs
                    activeTab={activeDetailTab}
                    onActiveTabChange={setActiveDetailTab}
                    leadId={id}
                    phone={phone}
                    messages={messages}
                    chatLoading={chatLoading}
                    chatError={chatError}
                    hasMore={hasMore}
                    chatSending={chatSending}
                    onLoadMore={loadMore}
                    onSendChat={handleSendChat}
                    onAttachChat={handleAttachChat}
                    handoffPending={conversationStatus?.isHandoffPending ?? false}
                    timelineRefreshKey={timelineRefreshKey}
                  />
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

            <aside className="space-y-4 mt-6">
              <LeadEditActionCard onEdit={() => router.push(`/leads/${id}/edit`)} />
              {canCreateQuoteOrVisit && (
                <LeadCommercialActionsCard
                  onOpenQuoteDrawer={() => setShowQuoteDrawer(true)}
                  onOpenVisitDrawer={() => setShowVisitDrawer(true)}
                  onOpenQuickSaleDrawer={() => setShowQuickSaleDrawer(true)}
                />
              )}
            </aside>
          </EntityTabPanel>

          <EntityTabPanel id="presupuestos">
            <LeadQuotesTab
              quotes={quotes}
              loading={loadingRelated}
              sendingQuoteId={sendingQuoteId}
              canCreate={canCreateQuoteOrVisit}
              onNewQuote={() => setShowQuoteDrawer(true)}
              onViewQuote={handleViewQuoteDetail}
              onSendQuote={handleSendQuote}
            />
          </EntityTabPanel>

          <EntityTabPanel id="ordenes">
            <LeadWorkOrdersTab workOrders={workOrders} loading={loadingSaleDetail} />
          </EntityTabPanel>

          <EntityTabPanel id="visitas">
            <LeadVisitsTab
              visits={visits}
              loading={loadingRelated}
              canCreate={canCreateQuoteOrVisit}
              onNewVisit={() => setShowVisitDrawer(true)}
            />
          </EntityTabPanel>

          <EntityTabPanel id="documentacion">
            <LeadDocumentationTab />
          </EntityTabPanel>

          <EntityTabPanel id="actividad">
            <LeadTimeline leadId={id} refreshKey={timelineRefreshKey} />
          </EntityTabPanel>
        </EntityTabs>
      </div>

      {/* Drawers */}
      <CreateQuoteDrawer
        isOpen={showQuoteDrawer}
        onClose={() => setShowQuoteDrawer(false)}
        leadId={id}
        leadName={lead.name}
        onSuccess={refreshLeadAndTimeline}
      />

      <CreateVisitDrawer
        isOpen={showVisitDrawer}
        onClose={() => setShowVisitDrawer(false)}
        leadId={id}
        leadName={lead.name}
        leadPhone={lead.phone}
        leadEmail={lead.email}
        onSuccess={refreshLeadAndTimeline}
      />

      <QuoteDetailDrawer
        isOpen={showQuoteDetail}
        onClose={() => {
          setShowQuoteDetail(false);
          setSelectedQuoteId(null);
        }}
        quoteId={selectedQuoteId || ''}
      />

      <QuickSaleDrawer
        isOpen={showQuickSaleDrawer}
        onClose={() => setShowQuickSaleDrawer(false)}
        leadId={id}
        leadName={lead.name}
        leadEmail={lead.email}
        leadPhone={lead.phone}
        leadCompany={lead.companyName}
        onSuccess={refreshLeadAndTimeline}
      />
    </EntityDetailLayout>
  );
}
