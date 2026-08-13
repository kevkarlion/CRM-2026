'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePipelineLeads } from '../hooks/usePipelineLeads';
import { usePipelineBoard } from '../hooks/usePipelineBoard';
import { useConversationStatus } from '../hooks/useConversationStatus';
import { usePendingHandoffs } from '../hooks/usePendingHandoffs';
import { useBotClients } from '../hooks/useBotClients';
import { useCustomerConversations } from '../hooks/useCustomerConversations';
import { calculateClientScore } from '@/clients/services/client-score.service';
import { PipelineColumn } from './PipelineColumn';
import { LeadFilters } from './LeadFilters';
import { LeadChatDrawer } from './LeadChatDrawer';
import { ClientChatDrawer } from './ClientChatDrawer';
import { ClientCard } from './ClientCard';
import type { ILead } from '../../types/lead';
import type { IClient } from '@/crm/types/client';

function SkeletonColumn() {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start animate-pulse">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="skeleton-text w-24 h-4" />
        <div className="skeleton-text w-6 h-4" />
      </div>
      <div className="p-2 space-y-2">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="flex items-center justify-center h-full py-16">
      <div className="text-center">
        <p className="text-gray-500 text-sm">No hay leads que coincidan con los filtros</p>
      </div>
    </div>
  );
}

export function PipelineBoard() {
  const searchParams = useSearchParams();
  const {
    pipeline,
    groups,
    unmatched,
    loading,
    error,
    refetch,
  } = usePipelineLeads();

  const stages = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.stages.filter((s) => s.isActive).sort((a, b) => a.position - b.position);
  }, [pipeline]);

  const { columns } = usePipelineBoard(stages, groups, refetch);

  // Read stage filter from URL params
  const visibleStageNames = useMemo(() => {
    const param = searchParams.get('stages');
    if (!param) return null; // null = all visible
    return new Set(param.split(','));
  }, [searchParams]);

  // Read ALL filter params from URL
  const filterParams = useMemo(() => ({
    search: searchParams.get('search')?.toLowerCase() || '',
    assignedTo: searchParams.get('assignedTo') || '',
    source: searchParams.get('source') || '',
    service: searchParams.get('service') || '',
    zone: searchParams.get('zone') || '',
    isBotActive: searchParams.get('isBotActive') === 'true',
    isHandoff: searchParams.get('isHandoff') === 'true',
    scoreMin: searchParams.get('scoreMin') || '',
    scoreMax: searchParams.get('scoreMax') || '',
    dateFrom: searchParams.get('createdAtGte') || '',
    dateTo: searchParams.get('createdAtLte') || '',
    lastContact: searchParams.get('lastContact') || '',
  }), [searchParams]);

  const [reFetching, setReFetching] = useState(false);

  // WhatsApp chat drawer state
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<ILead | null>(null);
  const [selectedClientForChat, setSelectedClientForChat] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [selectedClientConversationStatus, setSelectedClientConversationStatus] = useState<any>(null);
  const [showHandoffs, setShowHandoffs] = useState(false);
  
  // Confirmation modal for customer conversation resolve
  const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false);
  const [resolveConversationId, setResolveConversationId] = useState<string | null>(null);
  const [resolveConversationName, setResolveConversationName] = useState<string>('');
  
  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Collect all lead IDs across all columns for conversation status lookup
  const allLeadIds = useMemo(() => {
    const ids: string[] = [];
    for (const col of Object.values(columns)) {
      for (const lead of col) {
        ids.push(String(lead._id));
      }
    }
    for (const lead of unmatched) {
      ids.push(String(lead._id));
    }
    return ids;
  }, [columns, unmatched]);

  const { statusMap: conversationStatusMap } = useConversationStatus(allLeadIds);
  const { count: pendingHandoffs, handoffs: handoffList } = usePendingHandoffs();
  const { clients: botClients, refetch: refetchBotClients } = useBotClients();
  const { conversations: customerConversations, refetch: refetchCustomerConversations } = useCustomerConversations();

  // Open WhatsApp chat drawer for a lead
  const handleLeadWhatsAppClick = useCallback((lead: ILead) => {
    setSelectedLeadForChat(lead);
    setChatDrawerOpen(true);
  }, []);

  // Open chat for a specific lead (from quick actions)
  const handleOpenChat = useCallback((lead: ILead) => {
    setSelectedLeadForChat(lead);
    setChatDrawerOpen(true);
  }, []);

  // Quick reply opens the chat drawer focused on input
  const handleQuickReply = useCallback((lead: ILead) => {
    setSelectedLeadForChat(lead);
    setChatDrawerOpen(true);
  }, []);

  // Open resolve confirmation modal
  const handleOpenResolveConfirm = useCallback((conversationId: string, clientName: string) => {
    setResolveConversationId(conversationId);
    setResolveConversationName(clientName);
    setResolveConfirmOpen(true);
  }, []);

  // Open chat for a client from the customers column
  const handleClientChatClick = useCallback((clientId: string, clientName: string, phone: string, conversationStatus?: any) => {
    setSelectedClientForChat({ id: clientId, name: clientName, phone });
    setSelectedClientConversationStatus(conversationStatus || null);
    setChatDrawerOpen(true);
  }, []);

  // Resolve conversation (for modal)
  const handleResolveConversation = useCallback(async () => {
    if (!resolveConversationId) return;
    try {
      const res = await fetch(`/api/crm/conversations/${resolveConversationId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Atención marcada como resuelta' });
        refetchCustomerConversations();
      } else {
        setNotification({ type: 'error', message: 'Error al resolver' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al resolver' });
    } finally {
      setResolveConfirmOpen(false);
      setResolveConversationId(null);
      setResolveConversationName('');
      setTimeout(() => setNotification(null), 5000);
    }
  }, [resolveConversationId, refetchCustomerConversations]);

  // Resolve conversation directly by ID (for ClientCard button)
  const handleResolveConversationWithId = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/crm/conversations/${conversationId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Atención resuelta ✅' });
        refetchCustomerConversations();
      } else {
        setNotification({ type: 'error', message: 'Error al resolver' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al resolver' });
    }
    setTimeout(() => setNotification(null), 5000);
  }, [refetchCustomerConversations]);

  // Take case — assign the current user to the conversation
  const handleTakeCase = useCallback(async (lead: ILead) => {
    const status = conversationStatusMap.get(String(lead._id));
    if (!status?.conversationId) return;
    try {
      const res = await fetch(`/api/crm/conversations/${status.conversationId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(() => {
            if (typeof window === 'undefined') return {};
            const token = localStorage.getItem('token');
            const tenantId = localStorage.getItem('tenantId');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            if (tenantId) headers['x-tenant-id'] = tenantId;
            try {
              const payload = token ? JSON.parse(atob(token.split('.')[1])) : null;
              if (payload?.userId) headers['x-user-id'] = payload.userId;
            } catch { /* noop */ }
            return headers;
          })(),
        },
        body: JSON.stringify({ userId: (() => {
          try {
            const token = localStorage.getItem('token');
            return token ? JSON.parse(atob(token.split('.')[1])).userId : '';
          } catch { return ''; }
        })() }),
      });
      if (res.ok) {
        // Refresh conversation data
        conversationStatusMap.delete(String(lead._id));
        // Force re-render will happen via polling
      }
    } catch {
      // Silent fail — polling will retry
    }
  }, [conversationStatusMap]);

  // Real-time polling: refetch every 5 seconds for live WhatsApp leads
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      refetchBotClients();
      refetchCustomerConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch, refetchBotClients, refetchCustomerConversations]);

  const hasData = Object.keys(groups).length > 0;

  // Metrics for the filters bar
  const metrics = useMemo(() => {
    const allLeads = Object.values(columns).flat();
    const total = allLeads.length;
    const calientes = allLeads.filter((l) => l.temperature === 'hot').length;
    const handoffs = pendingHandoffs;
    const sinRespuesta = allLeads.filter((l) => !conversationStatusMap.has(String(l._id))).length;
    return { total, calientes, handoffs, sinRespuesta };
  }, [columns, pendingHandoffs, conversationStatusMap]);

  // Filter leads by ALL URL params
  const filteredColumns = useMemo(() => {
    const f = filterParams;
    const hasActiveFilter = f.search || f.assignedTo || f.source || f.service || f.zone
      || f.isBotActive || f.isHandoff || f.scoreMin || f.scoreMax
      || f.dateFrom || f.dateTo || f.lastContact;

    if (!hasActiveFilter) return columns;

    const result: Record<string, ILead[]> = {};
    for (const [stageName, leads] of Object.entries(columns)) {
      result[stageName] = leads.filter((lead) => {
        // Search by name or company
        if (f.search) {
          const q = f.search;
          const nameMatch = lead.name?.toLowerCase().includes(q);
          const companyMatch = lead.companyName?.toLowerCase().includes(q);
          if (!nameMatch && !companyMatch) return false;
        }

        // Source
        if (f.source && lead.source !== f.source) return false;

        // Service (inquiryReason)
        if (f.service && lead.inquiryReason !== f.service) return false;

        // Score range
        if (f.scoreMin && (lead.score ?? 0) < Number(f.scoreMin)) return false;
        if (f.scoreMax && (lead.score ?? 0) > Number(f.scoreMax)) return false;

        // Date range
        if (f.dateFrom) {
          const from = new Date(f.dateFrom);
          if (new Date(lead.createdAt) < from) return false;
        }
        if (f.dateTo) {
          const to = new Date(f.dateTo);
          to.setHours(23, 59, 59, 999);
          if (new Date(lead.createdAt) > to) return false;
        }

        // Conversation-based filters
        const convStatus = conversationStatusMap.get(String(lead._id));
        if (f.isBotActive && !convStatus?.isBotActive) return false;
        if (f.isHandoff && !convStatus?.isHandoffPending) return false;

        // Last contact
        if (f.lastContact) {
          const lastMsg = convStatus?.lastMessageAt;
          if (f.lastContact === 'never' && lastMsg) return false;
          if (f.lastContact === 'today') {
            if (!lastMsg) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (new Date(lastMsg) < today) return false;
          }
          if (f.lastContact === 'week') {
            if (!lastMsg) return false;
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (new Date(lastMsg) < weekAgo) return false;
          }
        }

        return true;
      });
    }
    return result;
  }, [columns, filterParams, conversationStatusMap]);

  const visibleColumns = filteredColumns;

  // Filter stages by URL param
  const filteredStages = useMemo(() => {
    if (!visibleStageNames) return stages;
    return stages.filter((s) => visibleStageNames.has(s.name));
  }, [stages, visibleStageNames]);

  const handleLeadClick = useCallback((leadId: string) => {
    console.log('Lead clicked:', leadId);
  }, []);

  if (error && !hasData) {
    return (
      <div className="h-full overflow-hidden">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const allEmpty = Object.values(groups).every(
    (g) => g.leads.length === 0,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <LeadFilters
        stages={stages}
        metrics={metrics}
        onNewLead={() => {/* TODO: open new lead modal */}}
        onExport={() => {/* TODO: export logic */}}
        onBulkAssign={() => {/* TODO: bulk assign */}}
        onViewActivity={() => {/* TODO: activity view */}}
      />

      {loading && !hasData ? (
        <div className="flex gap-4 p-4 overflow-x-auto scroll-snap-x-mandatory flex-1">
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
        </div>
      ) : allEmpty && !loading && unmatched.length === 0 ? (
        <EmptyBoard />
      ) : (
        <div className="flex gap-4 p-4 overflow-x-auto scroll-snap-x-mandatory flex-1">
          {filteredStages.map((stage) => {
            const stageLeads = visibleColumns[stage.name] || [];
            return (
              <PipelineColumn
                key={stage.name}
                stage={stage}
                leads={stageLeads}
                isLoading={false}
                onLeadClick={handleLeadClick}
                onWhatsAppClick={handleLeadWhatsAppClick}
                conversationStatusMap={conversationStatusMap}
                onTakeCase={handleTakeCase}
                onQuickReply={handleQuickReply}
                onOpenChat={handleOpenChat}
              />
            );
          })}

          {/* Columna de clientes con atención activa */}
          {customerConversations.length > 0 && (
            <div className="bg-green-50 rounded-lg border border-green-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start">
              <div className="flex items-center justify-between px-3 py-2 border-b border-green-200 bg-green-50 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-green-700 truncate">
                    Clientes
                  </h3>
                  <span className="badge badge-success text-xs shrink-0">
                    {customerConversations.length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {customerConversations.map((conv) => {
                  // Crear objeto cliente a partir de datos de conversación
                  const clientData = {
                    _id: conv.clientId,
                    name: conv.clientName,
                    companyName: conv.clientName,
                    phone: conv.clientPhone || '',
                    email: '',
                    operationStatus: conv.lifecycleState === 'ACTIVE_CLIENT' ? 'active' : 
                                     conv.lifecycleState === 'IN_PROGRESS' ? 'quote_pending' : 'none',
                    score: conv.clientScore ?? 0,
                    temperature: conv.clientTemperature as any,
                    assignedTo: null,
                    createdAt: conv.lastMessageAt ? { toString: () => conv.lastMessageAt } as any : undefined,
                    estimatedValue: undefined,
                    notes: '',
                    priority: 'medium',
                  } as any;

                  const conversationStatus = {
                    conversationId: conv.conversationId,
                    leadId: conv.clientId || '',
                    hasActiveConversation: true,
                    conversationState: conv.lifecycleState as any,
                    isBotActive: conv.owner === 'BOT' && ['ACTIVE_LEAD', 'ACTIVE_CLIENT', 'WAITING_OPERATOR', 'WAITING_CLIENT'].includes(conv.lifecycleState),
                    isHandoffPending: conv.lifecycleState === 'handoff_pending',
                    isHumanAssigned: conv.lifecycleState === 'human_assigned' || conv.lifecycleState === 'IN_PROGRESS',
                    lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
                    lastMessagePreview: conv.lastMessagePreview,
                    unreadCount: 0,
                    score: conv.clientScore ?? undefined,
                    temperature: conv.clientTemperature,
                  } as any;

                  return (
                    <ClientCard
                      key={conv.conversationId}
                      client={clientData}
                      onClick={(clientId) => window.location.href = `/clients/${clientId}`}
                      onWhatsAppClick={(client) => handleClientChatClick(client._id?.toString() || '', client.name, client.phone, conversationStatus)}
                      conversationStatus={conversationStatus}
                      onTakeCase={(client) => handleClientChatClick(client._id?.toString() || '', client.name, client.phone, conversationStatus)}
                      onQuickReply={(client) => handleClientChatClick(client._id?.toString() || '', client.name, client.phone, conversationStatus)}
                      onOpenChat={(client) => handleClientChatClick(client._id?.toString() || '', client.name, client.phone, conversationStatus)}
                      onResolve={() => handleResolveConversationWithId(conv.conversationId)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {unmatched.length > 0 && (
            <div className="bg-gray-100 rounded-lg border border-dashed border-gray-300 min-w-[85vw] md:min-w-[260px] snap-start">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-500 truncate">
                    Sin etapa
                  </h3>
                  <span className="badge badge-neutral text-xs shrink-0">
                    {unmatched.length}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Leads con estado sin etapa asignada
                </p>
              </div>
              <div className="p-2 space-y-2">
                {unmatched.map((lead) => (
                  <div
                    key={String(lead._id)}
                    className="bg-white rounded-lg border border-gray-200 p-3 opacity-60 cursor-default"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {lead.name}
                    </p>
                    {lead.companyName && (
                      <p className="text-xs text-gray-500 truncate">{lead.companyName}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Chat Drawer for Leads */}
      {selectedLeadForChat && (
        <LeadChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => {
            setChatDrawerOpen(false);
            setSelectedLeadForChat(null);
            setSelectedClientForChat(null);
            setSelectedClientConversationStatus(null);
          }}
          lead={selectedLeadForChat}
          client={null}
          conversationStatus={conversationStatusMap.get(String((selectedLeadForChat as any)._id)) ?? null}
        />
      )}

      {/* WhatsApp Chat Drawer for Clients */}
      {selectedClientForChat && (
        <ClientChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => {
            setChatDrawerOpen(false);
            setSelectedLeadForChat(null);
            setSelectedClientForChat(null);
            setSelectedClientConversationStatus(null);
          }}
          client={selectedClientForChat}
          conversationStatus={selectedClientConversationStatus}
        />
      )}

      {/* Confirmation Modal for Resolve */}
      {resolveConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmar acción</h3>
                <p className="text-sm text-gray-500">
                  ¿Marcar la atención de <strong>{resolveConversationName}</strong> como resuelta?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setResolveConfirmOpen(false);
                  setResolveConversationId(null);
                  setResolveConversationName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolveConversation}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
