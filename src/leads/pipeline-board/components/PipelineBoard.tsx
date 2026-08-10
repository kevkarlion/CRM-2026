'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePipelineLeads } from '../hooks/usePipelineLeads';
import { usePipelineBoard } from '../hooks/usePipelineBoard';
import { useConversationStatus } from '../hooks/useConversationStatus';
import { usePendingHandoffs } from '../hooks/usePendingHandoffs';
import { useBotClients } from '../hooks/useBotClients';
import { PipelineColumn } from './PipelineColumn';
import { LeadFilters } from './LeadFilters';
import { LeadChatDrawer } from './LeadChatDrawer';
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
  const [showHandoffs, setShowHandoffs] = useState(false);

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
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch, refetchBotClients]);

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

          {/* Columna de clientes con conversación activa */}
          {botClients.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start">
              <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 bg-blue-50 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-blue-700 truncate">
                    Clientes - Bot Activo
                  </h3>
                  <span className="badge badge-primary text-xs shrink-0">
                    {botClients.length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {botClients.map((client) => (
                  <div
                    key={String(client._id)}
                    className="bg-white rounded-lg border border-blue-100 p-2.5 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => {
                      // Navigate to client detail
                      window.location.href = `/clients/${client._id}`;
                    }}
                  >
                    <p className="text-xs md:text-[13px] font-semibold text-gray-900 leading-tight">
                      {client.companyName || client.fullName || 'Cliente'}
                    </p>
                    {client.phone && (
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={`tel:${client.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          {client.phone}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
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

      {/* WhatsApp Chat Drawer */}
      <LeadChatDrawer
        isOpen={chatDrawerOpen}
        onClose={() => {
          setChatDrawerOpen(false);
          setSelectedLeadForChat(null);
        }}
        lead={selectedLeadForChat}
        conversationStatus={selectedLeadForChat ? (conversationStatusMap.get(String(selectedLeadForChat._id)) ?? null) : null}
      />
    </div>
  );
}
