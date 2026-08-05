'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { CreateQuoteDrawer } from '@/leads/components/CreateQuoteDrawer';
import { CreateVisitDrawer } from '@/leads/components/CreateVisitDrawer';
import { QuoteDetailDrawer } from '@/leads/components/QuoteDetailDrawer';
import { QuickSaleDrawer } from '@/leads/components/QuickSaleDrawer';
import { LeadTimeline } from '@/activity/components/LeadTimeline';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import { useConversationStatus } from '@/leads/pipeline-board/hooks/useConversationStatus';
import { getDaysUntilExpiry } from '@/lib/format-date';

interface Lead {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  assignedTo?: { _id: string; name: string; email: string } | string;
  estimatedValue?: number;
  notes?: string;
  convertedToClient?: string;
  convertedToWorkOrder?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Quote {
  _id: string;
  number: string;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'direct_sale';
  total: number;
  validUntil: string | null;
  createdAt: string;
}

interface WorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  scheduledDate?: string;
  scheduledStart?: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'quote_sent', label: 'Presupuesto enviado' },
  { value: 'technical_visit', label: 'Visita técnica' },
  { value: 'negotiation', label: 'Negociación' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'disqualified', label: 'Descalificado' },
];

const STATUS_VARIANT: Record<string, string> = {
  new: 'bg-blue-50 border-blue-200 text-blue-700',
  contacted: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  quote_sent: 'bg-purple-50 border-purple-200 text-purple-700',
  technical_visit: 'bg-orange-50 border-orange-200 text-orange-700',
  negotiation: 'bg-amber-50 border-amber-200 text-amber-700',
  qualified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  won: 'bg-green-50 border-green-200 text-green-700',
  lost: 'bg-red-50 border-red-200 text-red-700',
  disqualified: 'bg-gray-50 border-gray-200 text-gray-500',
};

const STATUS_DOT_COLOR: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-indigo-500',
  quote_sent: 'bg-purple-500',
  technical_visit: 'bg-orange-500',
  negotiation: 'bg-amber-500',
  qualified: 'bg-emerald-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
  disqualified: 'bg-gray-400',
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  direct_sale: 'Venta Directa',
};

const QUOTE_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-success-50 text-success-700',
  rejected: 'bg-danger-50 text-danger-700',
  expired: 'bg-warning-50 text-warning-700',
  cancelled: 'bg-gray-100 text-gray-500',
  direct_sale: 'bg-success-50 text-success-700',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', call: 'Llamada', form: 'Formulario',
  referral: 'Referido', walk_in: 'Presencial', other: 'Otro',
};

function QuoteExpiryAlert({ validUntil }: { validUntil: string | null }) {
  const daysLeft = getDaysUntilExpiry(validUntil);
  
  if (daysLeft === null) return null;
  
  if (daysLeft < 0) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⚠️ Vencido hace {Math.abs(daysLeft)} días
        </p>
      </div>
    );
  }
  
  if (daysLeft === 0) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⚠️ Vence hoy
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 3) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⏰ Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  
  if (daysLeft <= 7) {
    return (
      <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded-lg">
        <p className="text-xs text-warning-700 font-medium">
          ⏰ Vence en {daysLeft} días
        </p>
      </div>
    );
  }
  
  return null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer states
  const [showQuoteDrawer, setShowQuoteDrawer] = useState(false);
  const [showVisitDrawer, setShowVisitDrawer] = useState(false);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Quote sending state
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);
  const [showQuickSaleDrawer, setShowQuickSaleDrawer] = useState(false);

  // Lists
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [visits, setVisits] = useState<WorkOrder[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  
  // Sale detail for converted leads
  const [saleDetail, setSaleDetail] = useState<{
    hasSale: boolean;
    workOrder?: { _id: string; workOrderNumber: string; status: string };
    quote?: { _id: string; number: string; title: string; status: string; total: number };
  } | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);

  // Chat state
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'chat' | 'timeline'>('info');
  
  // Conversation state for bot ↔ operator handoff
  const [conversation, setConversation] = useState<{
    _id: string;
    lifecycleState: string;
    owner: string;
    resolvedAt: string | null;
    waitingMessageCount: number;
    waitingPriority: string;
  } | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Fetch conversation data
  useEffect(() => {
    if (!id) return;
    
    const fetchConversation = async () => {
      setLoadingConversation(true);
      try {
        const res = await api.get<{ conversation: typeof conversation }>(`/api/crm/conversations/by-lead/${id}`);
        setConversation(res.conversation);
      } catch (error) {
        console.error('Error fetching conversation:', error);
      } finally {
        setLoadingConversation(false);
      }
    };
    
    fetchConversation();
  }, [id]);
  
  // Take control handler
  const handleTakeControl = async () => {
    if (!conversation?._id) return;
    
    setActionLoading(true);
    try {
      await api.post(`/api/crm/conversations/${conversation._id}/take-control`, {});
      setConversation(prev => prev ? { ...prev, owner: 'OPERATOR', lifecycleState: 'IN_PROGRESS' } : null);
    } catch (error) {
      console.error('Error taking control:', error);
    } finally {
      setActionLoading(false);
    }
  };
  
  // Mark as resolved handler
  const handleMarkResolved = async () => {
    if (!conversation?._id) return;
    
    setActionLoading(true);
    try {
      await api.post(`/api/crm/conversations/${conversation._id}/resolve`, {});
      setConversation(prev => prev ? { ...prev, owner: 'OPERATOR', lifecycleState: 'RESOLVED', resolvedAt: new Date().toISOString() } : null);
    } catch (error) {
      console.error('Error marking resolved:', error);
    } finally {
      setActionLoading(false);
    }
  };
  
  // Admin notes state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  
  const saveNotes = async () => {
    try {
      await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: notesValue }),
      });
      setLead((prev) => prev ? { ...prev, adminNotes: notesValue } : null);
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };
  
  // Initialize notes value when entering edit mode
  useEffect(() => {
    if (isEditingNotes && lead?.adminNotes !== undefined) {
      setNotesValue(lead.adminNotes || '');
    }
  }, [isEditingNotes, lead?.adminNotes]);
  
  const phone = lead?.phone || '';
  const {
    messages,
    loading: chatLoading,
    error: chatError,
    hasMore,
    loadMore,
    refetch: refetchChat,
  } = useChatMessages(phone);
  const { sendMessage, sending: chatSending } = useWhatsAppSend();
  const { statusMap } = useConversationStatus([id]);
  const conversationStatus = statusMap.get(id) || null;

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

  useChatPolling({
    interval: 5000,
    enabled: activeDetailTab === 'chat',
    onPoll: refetchChat,
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<Lead>(`/api/crm/leads/${id}`);
        setLead(data);
        
        if (data.status === 'contacted' || data.status === 'quote_sent' || data.status === 'technical_visit') {
          loadRelatedData();
        }
        
        // Load sale detail if converted
        if (data.convertedToClient || data.convertedToWorkOrder) {
          loadSaleDetail(data.convertedToClient, data.convertedToWorkOrder);
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
        api.get<{ data: Quote[] }>(`/api/crm/leads/${id}/quotes`),
        api.get<WorkOrder[]>(`/api/crm/leads/${id}/visits`).catch(() => []),
      ]);
      setQuotes(quotesData.data || quotesData);
      setVisits(visitsData);
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }

  async function loadSaleDetail(convertedClientId?: string, convertedWorkOrderId?: string) {
    if (!convertedClientId && !convertedWorkOrderId) return;
    setLoadingSaleDetail(true);
    try {
      const data = await api.get<typeof saleDetail>(`/api/crm/leads/${id}/sale-detail`);
      setSaleDetail(data);
    } catch (err) {
      console.error('Error loading sale detail:', err);
    } finally {
      setLoadingSaleDetail(false);
    }
  }

  async function handleSendQuote(quoteId: string) {
    setSendingQuoteId(quoteId);
    try {
      await api.post(`/api/crm/quotes/${quoteId}/send`, {});
      // Refresh quotes and lead
      await loadRelatedData();
      const refreshed = await api.get<Lead>(`/api/crm/leads/${id}`);
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
        <button onClick={() => router.push('/leads')} className="mt-4 text-sm text-brand-600 font-medium">
          Volver a leads
        </button>
      </div>
    );
  }

  const isConverted = !!lead.convertedToClient;
  const isContacted = lead?.status === 'contacted' || lead?.status === 'quote_sent' || lead?.status === 'technical_visit';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/leads')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lead.name}</h1>
            {lead.companyName && (
              <p className="text-sm text-gray-500">{lead.companyName}</p>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${STATUS_VARIANT[lead.status] || 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLOR[lead.status] || 'bg-gray-400'}`} />
            {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
          </span>
          {isConverted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border bg-green-50 border-green-200 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Convertido
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Información del Lead</h2>
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Nombre" value={lead.name} />
              <DetailRow label="Empresa" value={lead.profileName || lead.companyName || '—'} />
              <DetailRow label="Email" value={lead.email || '—'} />
              <DetailRow label="Teléfono" value={lead.phone || '—'} />
              <DetailRow label="Dirección" value={
                [lead.address, lead.locality, lead.province].filter(Boolean).join(', ') || '—'
              } />
              <DetailRow label="Origen" value={SOURCE_LABELS[lead.source] || lead.source} />
              <DetailRow label="Valor Estimado" value={lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'} />
              <DetailRow label="Asignado a" value={
                lead.assignedTo
                  ? (typeof lead.assignedTo === 'object' ? lead.assignedTo.name : lead.assignedTo)
                  : '—'
              } />
              <DetailRow label="Creado" value={new Date(lead.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} />
              <DetailRow label="Actualizado" value={new Date(lead.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} />
              {isConverted && (
                <>
                  <DetailRow label="Convertido" value={lead.convertedAt ? new Date(lead.convertedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sí'} />
                  {lead.convertedToWorkOrder && (
                    <div className="flex items-center py-3 border-b border-gray-100 last:border-0">
                      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">OT Creada</dt>
                      <dd className="text-sm mt-0.5 sm:mt-0">
                        <a
                          href={`/work-orders/${lead.convertedToWorkOrder}`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Ver Orden de Trabajo →
                        </a>
                      </dd>
                    </div>
                  )}
                </>
              )}

              {/* Detalle de venta para leads convertidos */}
              {isConverted && (
                loadingSaleDetail ? (
                  <div className="flex items-center py-3 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">Detalle de Venta</dt>
                    <dd className="text-sm text-gray-400">Cargando...</dd>
                  </div>
                ) : saleDetail?.hasSale && saleDetail.quote ? (
                  <div className="space-y-2 py-3 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-500">Detalle de Venta</dt>
                    <dd className="text-sm">
                      <div className="flex items-center gap-3">
                        <a
                          href={`/quotes/${saleDetail.quote._id}`}
                          className="text-brand-600 hover:text-brand-700 font-medium flex-1"
                        >
                          {saleDetail.quote.title} (${saleDetail.quote.total.toLocaleString()}) →
                        </a>
                        <button
                          onClick={() => handleViewQuoteDetail(saleDetail.quote!._id)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Ver
                        </button>
                      </div>
                    </dd>
                  </div>
                ) : null
              )}
            </dl>
          </div>

          {lead.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Resumen MSJ</h2>
              {(() => {
                const lines = lead.notes.split('\n');
                const summaryLine = lines[0]; // First line is the bot summary (Servicio | Necesidad | Descripción)
                return <p className="text-sm text-gray-700">{summaryLine}</p>;
              })()}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Notas</h2>
            {isEditingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  rows={4}
                  placeholder="Notas privadas del administrador..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditingNotes(true)}
                className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2"
              >
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {lead.adminNotes || 'Haz clic para agregar notas...'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveDetailTab('chat')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeDetailTab === 'chat'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Chat WhatsApp
                {conversationStatus?.isHandoffPending && (
                  <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500 inline-block" />
                )}
              </button>
              <button
                onClick={() => setActiveDetailTab('timeline')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeDetailTab === 'timeline'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Actividad
              </button>
            </div>

            {/* Content */}
            <div className={activeDetailTab === 'chat' ? 'h-[500px]' : ''}>
              {activeDetailTab === 'chat' ? (
                <ChatPanel
                  messages={messages}
                  loading={chatLoading}
                  error={chatError}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onSend={handleSendChat}
                  sending={chatSending}
                  selectedPhone={phone || null}
                />
              ) : (
                <div className="p-6">
                  <LeadTimeline leadId={id} refreshKey={timelineRefreshKey} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Acciones</h3>
            <button onClick={() => router.push(`/leads/${id}/edit`)}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
              Editar Lead
            </button>
          </div>

          {/* Conversation Bot ↔ Operator Handoff - siempre visible */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Control del Bot</h3>
              {conversation ? (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  conversation.owner === 'BOT' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {conversation.owner === 'BOT' ? '🤖 Bot activo' : '👤 Operador'}
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                  Sin conversación
                </span>
              )}
            </div>
            
            {/* Si hay conversación, mostrar detalles */}
            {conversation ? (
              <>
                {/* Estado actual */}
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Estado: <span className="font-medium">{conversation.lifecycleState}</span></p>
                  {conversation.waitingMessageCount > 0 && (
                    <p>Mensajes sin atender: <span className="font-medium">{conversation.waitingMessageCount}</span></p>
                  )}
                  {conversation.resolvedAt && (
                    <p>Resuelto: <span className="font-medium">{new Date(conversation.resolvedAt).toLocaleString()}</span></p>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="space-y-2 pt-2">
                  {/* Tomar control - siempre visible, se habilita si el bot tiene control */}
                  <button 
                    onClick={handleTakeControl}
                    disabled={actionLoading || conversation.owner === 'OPERATOR'}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      conversation.owner === 'OPERATOR' 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-800 text-white hover:bg-gray-900'
                    }`}>
                    {actionLoading ? 'Tomando...' : '👤 Tomar control'}
                  </button>

                  {/* Marcar como resuelto - siempre visible */}
                  <button 
                    onClick={handleMarkResolved}
                    disabled={actionLoading || conversation.lifecycleState === 'RESOLVED'}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      conversation.lifecycleState === 'RESOLVED'
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-success-500 text-white hover:bg-success-600'
                    }`}>
                    {actionLoading ? 'Marcando...' : '✅ Marcar como resuelto'}
                  </button>

                  {/* Info cuando está resuelto */}
                  {conversation.lifecycleState === 'RESOLVED' && (
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-success-700">
                        ✅ Conversación resuelta
                        {conversation.resolvedAt && (
                          <span className="block text-xs mt-1">
                            (hace {Math.round((Date.now() - new Date(conversation.resolvedAt).getTime()) / (1000 * 60 * 60))} horas)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Si no hay conversación */
              <div className="text-sm text-gray-500 text-center py-4">
                <p>No hay conversación activa con este lead.</p>
                <p className="text-xs mt-1">El lead no ha escrito por WhatsApp.</p>
              </div>
            )}
          </div>

          {/* Acciones de Lead Contactado */}
          {isContacted && !isConverted && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Gestión Comercial</h3>
              
              <button 
                onClick={() => setShowQuoteDrawer(true)}
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                Enviar Presupuesto
              </button>
              
              <button 
                onClick={() => setShowVisitDrawer(true)}
                className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors">
                Programar Visita Técnica
              </button>
              
              <button 
                onClick={() => setShowQuickSaleDrawer(true)}
                className="w-full rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 transition-colors">
                Confirmar Venta
              </button>
            </div>
          )}

          {/* Lista de Presupuestos */}
          {quotes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Presupuestos ({quotes.length})</h3>
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <button
                          onClick={() => handleViewQuoteDetail(quote._id)}
                          className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors text-left"
                        >
                          {quote.title}
                        </button>
                        <p className="text-xs text-gray-500">#{quote.number}</p>
                      </div>
                      <div className="text-right ml-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_VARIANT[quote.status]}`}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </span>
                        <p className="text-sm font-medium text-gray-900 mt-1">${quote.total.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Alerta de caducidad para presupuestos enviados */}
                    {quote.status === 'sent' && <QuoteExpiryAlert validUntil={quote.validUntil} />}
                    
                    {/* Botones de acción */}
                    <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => handleViewQuoteDetail(quote._id)}
                        className="flex-1 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                      >
                        Ver Detalle
                      </button>
                      {quote.status === 'draft' && (
                        <button
                          onClick={() => handleSendQuote(quote._id)}
                          disabled={sendingQuoteId === quote._id}
                          className="flex-1 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                        >
                          {sendingQuoteId === quote._id ? 'Enviando...' : 'Enviar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Visitas Técnicas */}
          {visits.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Visitas Técnicas</h3>
              <div className="space-y-2">
                {visits.map((visit) => (
                  <div key={visit._id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{visit.title}</p>
                      <p className="text-xs text-gray-500">#{visit.workOrderNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                      <p className="text-xs text-gray-400 capitalize">{visit.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawers */}
      <CreateQuoteDrawer
        isOpen={showQuoteDrawer}
        onClose={() => setShowQuoteDrawer(false)}
        leadId={id}
        leadName={lead?.name || ''}
        onSuccess={() => {
          loadRelatedData();
          setTimelineRefreshKey((k) => k + 1);
          // Refresh lead status
          api.get<Lead>(`/api/crm/leads/${id}`).then(setLead);
        }}
      />

      <CreateVisitDrawer
        isOpen={showVisitDrawer}
        onClose={() => setShowVisitDrawer(false)}
        leadId={id}
        leadName={lead?.name || ''}
        leadPhone={lead?.phone}
        leadEmail={lead?.email}
        onSuccess={() => {
          loadRelatedData();
          setTimelineRefreshKey((k) => k + 1);
          // Refresh lead status
          api.get<Lead>(`/api/crm/leads/${id}`).then(setLead);
        }}
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
        leadName={lead?.name || ''}
        leadEmail={lead?.email}
        leadPhone={lead?.phone}
        leadCompany={lead?.companyName}
        onSuccess={() => {
          // Refresh everything including timeline
          api.get<Lead>(`/api/crm/leads/${id}`).then(setLead);
          loadRelatedData();
          setTimelineRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
