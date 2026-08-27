'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePipelineLeads } from '../hooks/usePipelineLeads';
import { usePipelineBoard } from '../hooks/usePipelineBoard';
import { useConversationStatus } from '../hooks/useConversationStatus';
import { usePendingHandoffs } from '../hooks/usePendingHandoffs';
import { useBotClients } from '../hooks/useBotClients';
import { useCustomerConversations, type CustomerEntry } from '../hooks/useCustomerConversations';
import { useFollowUpMarks } from '../hooks/useFollowUpMarks';
import { MarkForFollowUpModal } from '@/components/follow-up/MarkForFollowUpModal';

// Relative time helper
function relativeTime(date: Date | string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months}meses`;
}
import { calculateClientScore } from '@/clients/services/client-score.service';
import { PipelineColumn } from './PipelineColumn';
import { LeadFilters } from './LeadFilters';
import { LeadChatDrawer } from './LeadChatDrawer';
import { ClientChatDrawer } from './ClientChatDrawer';
import { ClientCard } from './ClientCard';
import { FollowUpBadge } from '@/components/follow-up/FollowUpBadge';
import type { ILead } from '../../types/lead';

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

  // Filter out leads that are closed - they shouldn't appear in pipeline
  // Note: leads with status 'won' and convertedAt should still show in "Ganado"
  const filteredGroups = useMemo(() => {
    const result: typeof groups = {};
    for (const [stageName, stageData] of Object.entries(groups)) {
      result[stageName] = {
        ...stageData,
        leads: stageData.leads.filter((lead: ILead) => lead.status !== 'closed'),
      };
    }
    return result;
  }, [groups]);

  const { columns } = usePipelineBoard(stages, filteredGroups, refetch);

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
  const [resolveLeadId, setResolveLeadId] = useState<string | null>(null); // For leads without conversation
  
  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Follow-up marking state
  const [followUpMarkModalOpen, setFollowUpMarkModalOpen] = useState(false);
  const [followUpMarkTarget, setFollowUpMarkTarget] = useState<{ type: 'lead' | 'client'; id: string; name: string } | null>(null);
  const { marks, loading: marksLoading, fetchMarks, createMark, deleteMark } = useFollowUpMarks();

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

  // Fetch ALL follow-up marks on mount (not just current user's)
  useEffect(() => {
    fetchMarks();
  }, [fetchMarks]);

  // Polling para actualizar marks en tiempo real (solo para Rolija)
  useEffect(() => {
    // Solo Rolija necesita polling para ver badges actualizados
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    let isRolija = false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      isRolija = payload.email?.toLowerCase() === 'ro.lija@hotmail.com';
    } catch {}
    if (!isRolija) return;

    const interval = setInterval(() => {
      fetchMarks();
    }, 15000); // Cada 15 segundos

    return () => clearInterval(interval);
  }, [fetchMarks]);

  const { statusMap: conversationStatusMap } = useConversationStatus(allLeadIds);
  const { count: pendingHandoffs, handoffs: handoffList } = usePendingHandoffs();
  const { clients: botClients, refetch: refetchBotClients } = useBotClients();
  const { customers, loading: loadingCustomers, refetch: refetchCustomers } = useCustomerConversations();

  // Map Gestion status to pipeline stage name (Spanish names from DB)
  const mapGestionStatusToStage = (status: string): string => {
    const statusToStage: Record<string, string> = {
      'new': 'Nuevo contacto',
      'contacted': 'Contactado',
      'qualified': 'Calificado',
      'quote_sent': 'Presupuesto enviado',
      'proposal': 'Presupuesto enviado',
      'technical_visit': 'Visita técnica',
      'negotiation': 'Negociación',
      'won': 'Ganado',
      'lost': 'Perdido',
      'closed': 'Ganado', // Closed still shows in Ganado for reference
    };
    return statusToStage[status] || 'Nuevo contacto';
  };

  // Las Gestiones ya NO se muestran en el pipeline de leads
  // Se muestran en la columna "Clientes" separada
  const columnsWithGestions = columns;

  // Helper to get conversation status for a lead or gestion (must be before handlers that use it)
  const getConversationStatus = useCallback((lead: ILead) => {
    const isGestion = (lead as any).isFromGestion === true || lead.source === 'gestion';
    if (isGestion) {
      // For Gestiones, try originalLeadId first, then own ID, then by phone
      const originalLeadId = (lead as any).originalLeadId;
      if (originalLeadId) {
        const status = conversationStatusMap.get(String(originalLeadId)) ?? conversationStatusMap.get(String(lead._id));
        if (status) return status;
      }
      // Try by phone number - normalize to match conversation phoneNumber
      if (lead.phone) {
        const normalizedPhone = lead.phone.replace(/\D/g, '');
        for (const [key, convStatus] of conversationStatusMap.entries()) {
          // Check if any conversation matches this phone (for customer conversations)
          if (key.includes(normalizedPhone) || normalizedPhone.includes(key.slice(-9))) {
            return convStatus;
          }
        }
      }
      // Try by clientId from Gestion
      const clientIdFromGestion = (lead as any).clientId;
      if (clientIdFromGestion) {
        const clientIdStr = typeof clientIdFromGestion === 'string' ? clientIdFromGestion : String(clientIdFromGestion);
        // Search in conversationStatusMap for clientId
        for (const [key, convStatus] of conversationStatusMap.entries()) {
          // Also check if this is a customer conversation by looking up by clientId in another way
          // The conversation API should return clientId in the conversation
          if (key === clientIdStr || (convStatus as any).clientId === clientIdStr) {
            return convStatus;
          }
        }
      }
      return conversationStatusMap.get(String(lead._id));
    }
    // For regular leads, use own ID
    return conversationStatusMap.get(String(lead._id));
  }, [conversationStatusMap]);

  // Open WhatsApp chat drawer for a lead
  const handleLeadWhatsAppClick = useCallback((lead: ILead) => {
    const isGestion = (lead as any).isFromGestion === true || lead.source === 'gestion';
    if (isGestion) {
      // It's a Gestion - open client chat with the clientId
      const clientData = lead.clientId as any;
      const clientId = typeof clientData === 'string' ? clientData : clientData?._id;
      if (clientId) {
        // Get conversation status using originalLeadId for proper tracking
        const convStatus = getConversationStatus(lead);
        setSelectedClientForChat({
          id: clientId,
          name: lead.name || 'Cliente',
          phone: lead.phone || '',
        });
        setSelectedClientConversationStatus(convStatus || null);
        setChatDrawerOpen(true);
        return;
      }
    }
    setSelectedLeadForChat(lead);
    setChatDrawerOpen(true);
  }, [getConversationStatus]);

  // Open chat for a specific lead (from quick actions)
  const handleOpenChat = useCallback((lead: ILead) => {
    const isGestion = (lead as any).isFromGestion === true || lead.source === 'gestion';
    if (isGestion) {
      // It's a Gestion - open client chat with the clientId
      const clientData = lead.clientId as any;
      const clientId = typeof clientData === 'string' ? clientData : clientData?._id;
      if (clientId) {
        // Get conversation status using originalLeadId for proper tracking
        const convStatus = getConversationStatus(lead);
        setSelectedClientForChat({
          id: clientId,
          name: lead.name || 'Cliente',
          phone: lead.phone || '',
        });
        setSelectedClientConversationStatus(convStatus || null);
        setChatDrawerOpen(true);
        return;
      }
    }
    setSelectedLeadForChat(lead);
    setChatDrawerOpen(true);
  }, [getConversationStatus]);

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

  // Resolve lead (handles both conversation-based and direct lead resolve)
  const handleResolveConversation = useCallback(async () => {
    if (!resolveConversationId && !resolveLeadId) return;
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      
      let res: Response;
      
      if (resolveConversationId) {
        // Resolve via conversation (existing behavior)
        res = await fetch(`/api/crm/conversations/${resolveConversationId}/resolve`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          },
        });
      } else if (resolveLeadId) {
        // Direct lead status change (no conversation)
        res = await fetch(`/api/crm/leads/${resolveLeadId}/status`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          },
          body: JSON.stringify({ status: 'disqualified' }),
        });
      } else {
        return;
      }
      
      console.log('[Resolve] Response status:', res.status);
      if (res.ok) {
        setNotification({ type: 'success', message: 'Lead descalificado' });
        // Refresh leads and gestions
        refetch();
        refetchCustomers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setNotification({ type: 'error', message: errorData.error || 'Error al descalificar' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al resolver' });
    } finally {
      setResolveConfirmOpen(false);
      setResolveConversationId(null);
      setResolveConversationName('');
      setResolveLeadId(null);
      setTimeout(() => setNotification(null), 5000);
    }
  }, [resolveConversationId, resolveLeadId, refetch, refetchCustomers]);

  // Resolve conversation directly by ID (for ClientCard button)
  const handleResolveConversationWithId = useCallback(async (conversationId: string) => {
    console.log('[Resolve] handleResolveConversationWithId called with:', conversationId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/crm/conversations/${conversationId}/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      console.log('[Resolve] handleResolveConversationWithId response:', res.status);
      if (res.ok) {
        setNotification({ type: 'success', message: 'Lead descalificado ✅' });
        refetchCustomers();
      } else {
        setNotification({ type: 'error', message: 'Error al resolver' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al resolver' });
    }
    setTimeout(() => setNotification(null), 5000);
  }, [refetchCustomers]);

  // Resolve lead - works with or without conversation
  const handleLeadResolve = useCallback(async (lead: ILead) => {
    // If lead is won, resolve it (close lead and create new Gestion)
    if (lead.status === 'won') {
      try {
        // Determine if it's a Lead or Gestion
        const isGestion = (lead as any).isFromGestion === true || lead.source === 'gestion';
        
        let endpoint: string;
        if (isGestion) {
          // For Gestion, use client endpoint with clientId
          const clientId = (lead as any).clientId;
          endpoint = `/api/crm/clients/${clientId}/resolve`;
        } else {
          // For Lead, use lead endpoint
          endpoint = `/api/crm/leads/${lead._id}/resolve`;
        }
        
        const res = await fetch(endpoint, {
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
              return headers;
            })(),
          },
        });
        
        if (res.ok) {
          // Refresh data
          refetch();
          refetchCustomers?.();
        } else {
          console.error('[Resolve] Failed:', res.status);
        }
      } catch (error) {
        console.error('[Resolve] Error:', error);
      }
      return;
    }
    
    // Otherwise, open modal to disqualify (existing behavior)
    const status = getConversationStatus(lead);
    
    // Open modal regardless - with or without conversation
    setResolveConversationId(status?.conversationId ?? null);
    setResolveLeadId(String(lead._id));
    setResolveConversationName(lead.profileName || lead.name || lead.companyName || 'este lead');
    setResolveConfirmOpen(true);
  }, [conversationStatusMap, refetch, refetchCustomers]);

  // Take case — assign the current user to the conversation
  const handleTakeCase = useCallback(async (lead: ILead) => {
    const status = getConversationStatus(lead);
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
      refetchCustomers();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch, refetchBotClients, refetchCustomers]);

  const hasData = Object.keys(groups).length > 0;

  // Metrics for the filters bar
  const metrics = useMemo(() => {
    const allLeads = Object.values(columnsWithGestions).flat();
    const total = allLeads.length;
    const calientes = allLeads.filter((l) => l.temperature === 'hot').length;
    const handoffs = pendingHandoffs;
    const sinRespuesta = allLeads.filter((l) => !conversationStatusMap.has(String(l._id))).length;
    return { total, calientes, handoffs, sinRespuesta };
  }, [columnsWithGestions, pendingHandoffs, conversationStatusMap]);

  // Filter leads by ALL URL params
  const filteredColumns = useMemo(() => {
    const f = filterParams;
    const hasActiveFilter = f.search || f.assignedTo || f.source || f.service || f.zone
      || f.isBotActive || f.isHandoff || f.scoreMin || f.scoreMax
      || f.dateFrom || f.dateTo || f.lastContact;

    if (!hasActiveFilter) {
      // Sort leads: inbound recent first, then outbound waiting, then by score
      const result: Record<string, ILead[]> = {};
      for (const [stageName, leads] of Object.entries(columnsWithGestions)) {
        const sortedLeads = [...leads].sort((a, b) => {
          const convA = getConversationStatus(a);
          const convB = getConversationStatus(b);
          
          // Priority 1: Has unread inbound (lead wrote after last read)
          const hasUnreadA = convA?.lastInboundMessageAt && 
            (!convA.lastReadAt || new Date(convA.lastInboundMessageAt) > new Date(convA.lastReadAt));
          const hasUnreadB = convB?.lastInboundMessageAt && 
            (!convB.lastReadAt || new Date(convB.lastInboundMessageAt) > new Date(convB.lastReadAt));
          
          // Priority 2: Bot sent message but no reply yet
          const botSentA = convA?.lastMessageDirection === 'outbound' && convA.isBotActive && !hasUnreadA;
          const botSentB = convB?.lastMessageDirection === 'outbound' && convB.isBotActive && !hasUnreadB;
          
          // Sort: has unread inbound > bot sent > others
          if (hasUnreadA && !hasUnreadB) return -1;
          if (!hasUnreadA && hasUnreadB) return 1;
          if (botSentA && !botSentB) return -1;
          if (!botSentA && botSentB) return 1;
          
          // Then by score
          const getPriorityScore = (p?: string) => {
            if (p === 'high') return 300;
            if (p === 'medium') return 200;
            if (p === 'low') return 100;
            return 0;
          };
          const getTempScore = (t?: string) => {
            if (t === 'hot') return 30;
            if (t === 'warm') return 20;
            if (t === 'cold') return 10;
            return 0;
          };
          const aScore = getPriorityScore(a.priority) + getTempScore(a.temperature) + (a.score || 0);
          const bScore = getPriorityScore(b.priority) + getTempScore(b.temperature) + (b.score || 0);
          return bScore - aScore;
        });
        result[stageName] = sortedLeads;
      }
      return result;
    }

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
        const convStatus = getConversationStatus(lead);
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
  }, [columnsWithGestions, filterParams, conversationStatusMap]);

  const visibleColumns = filteredColumns;

  // Filter stages by URL param
  const filteredStages = useMemo(() => {
    if (!visibleStageNames) return stages;
    return stages.filter((s) => visibleStageNames.has(s.name));
  }, [stages, visibleStageNames]);

  const handleLeadClick = useCallback((leadId: string) => {
    console.log('Lead clicked:', leadId);
  }, []);

  // Follow-up mark handlers
  const handleMarkForFollowUp = useCallback((type: 'lead' | 'client', id: string, name: string) => {
    setFollowUpMarkTarget({ type, id, name });
    setFollowUpMarkModalOpen(true);
  }, []);

  const handleFollowUpMarkSuccess = useCallback(() => {
    setFollowUpMarkModalOpen(false);
    setFollowUpMarkTarget(null);
    // Refetch marks - get current user email from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.email) {
          fetchMarks(payload.email);
        }
      } catch {}
    }
    // SSE broadcast is handled by the API route automatically
  }, [fetchMarks]);

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
                getConversationStatus={getConversationStatus}
                onTakeCase={handleTakeCase}
                onQuickReply={handleQuickReply}
                onOpenChat={handleOpenChat}
                onResolve={handleLeadResolve}
                followUpMarks={marks}
                onMarkForFollowUp={(lead) => handleMarkForFollowUp('lead', String(lead._id), lead.name || 'Lead')}
              />
            );
          })}

          {/* Columna Clientes - solo aparece si hay clientes */}
          {customers.length > 0 && (
            <div className="bg-green-50 rounded-lg border border-green-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start flex flex-col max-h-[calc(100vh-180px)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-green-200 bg-green-50 rounded-t-lg shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-green-700 truncate">
                    Clientes
                  </h3>
                  <span className="badge badge-success text-xs shrink-0">
                    {customers.length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {customers.map((customer) => {
                  const typeLabel = customer.type === 'gestion' ? 'Gestión' : customer.type === 'client' ? 'Cliente' : 'Lead';
                  const typeBadge = customer.type === 'gestion' ? 'bg-green-100 text-green-700 border-green-200' : 
                                   customer.type === 'client' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                   'bg-purple-100 text-purple-700 border-purple-200';
                  
                  // Badge de nueva actividad - igual que en LeadCard
                  // Se muestra cuando: hay lastInboundMessageAt Y (no hay lastReadAt O lastInboundMessageAt > lastReadAt)
                  const hasNewActivity = customer.lastInboundMessageAt && 
                    (!customer.lastReadAt || new Date(customer.lastInboundMessageAt) > new Date(customer.lastReadAt));
                  
                  // Temperature config
                  const TEMP_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
                    hot: { label: 'Caliente', icon: '🔥', className: 'bg-red-100 text-red-700 border-red-200' },
                    warm: { label: 'Tibio', icon: '🌡️', className: 'bg-orange-100 text-orange-700 border-orange-200' },
                    cold: { label: 'Frío', icon: '❄️', className: 'bg-blue-100 text-blue-700 border-blue-200' },
                  };
                  const tempConfig = customer.temperature ? TEMP_CONFIG[customer.temperature] : null;
                  
                  // Check if customer has follow-up mark
                  const customerMark = marks?.find(m => 
                    m.targetId === customer.id || 
                    m.targetId === customer.clientId ||
                    m.targetId === customer.leadId
                  );
                  // Show badge for all users
                  const showFollowUpBadge = !!customerMark;
                  
                  return (
                    <div
                      key={customer.id}
                      className={`bg-white rounded-lg border-2 border-l-4 border-l-green-500 border-gray-200 p-2.5 cursor-pointer shadow-sm hover:shadow-md transition-shadow w-full ${
                        hasNewActivity ? 'border-blue-300' : ''
                      }`}
                      onClick={() => {
                        const convId = customer.conversationId;
                        setSelectedClientForChat({
                          id: customer.id,
                          name: customer.name,
                          phone: customer.phone || '',
                        });
                        setSelectedClientConversationStatus({
                          conversationId: convId,
                          leadId: customer.leadId || customer.gestionId || customer.clientId || '',
                          hasActiveConversation: customer.hasActiveConversation,
                          conversationState: customer.lifecycleState as any || null,
                          isBotActive: customer.lifecycleState === 'ACTIVE_CLIENT' && customer.owner === 'BOT',
                          isHandoffPending: false,
                          isHumanAssigned: customer.lifecycleState === 'IN_PROGRESS',
                          lastMessageAt: customer.lastMessageAt ? new Date(customer.lastMessageAt) : null,
                          lastReadAt: customer.lastReadAt ? new Date(customer.lastReadAt) : null,
                          lastInboundMessageAt: customer.lastInboundMessageAt ? new Date(customer.lastInboundMessageAt) : undefined,
                          lastMessageDirection: customer.hasNewActivity ? 'inbound' : null,
                          lastMessagePreview: customer.lastMessagePreview || null,
                          unreadCount: 0,
                          profileName: customer.profileName,
                        });
                        setChatDrawerOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Cliente: ${customer.name}`}
                    >
                      <div>
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${typeBadge}`}>
                            {customer.type === 'gestion' ? '🟢' : customer.type === 'client' ? '👤' : '📈'} {typeLabel}
                          </span>
                          {tempConfig && (
                            <span className={`inline-flex items-center px-1 py-px rounded text-[9px] font-medium border ${tempConfig.className}`}>
                              {tempConfig.icon} {customer.score || 0}
                            </span>
                          )}
                          {customer.score && !customer.temperature && (
                            <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                              {customer.score} pts
                            </span>
                          )}
                          {/* Badge de seguimiento - solo Rolija */}
                          {showFollowUpBadge && <FollowUpBadge mark={customerMark} />}
                        </div>
                        {customer.profileName && (
                          <p className="text-xs md:text-[13px] font-bold text-gray-900 leading-tight">
                            {customer.profileName}
                          </p>
                        )}
                        <p className="text-[10px] md:text-[11px] text-gray-500 truncate mt-0.5">
                          {customer.name}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {customer.phone && (
                            <>
                              <a
                                href={`tel:${customer.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-brand-600 hover:underline"
                              >
                                {customer.phone}
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClientForChat({
                                    id: customer.id,
                                    name: customer.name,
                                    phone: customer.phone || '',
                                  });
                                  setSelectedClientConversationStatus({
                                    conversationId: customer.conversationId || '',
                                    leadId: customer.leadId || customer.gestionId || customer.clientId || '',
                                    hasActiveConversation: customer.hasActiveConversation,
                                    conversationState: customer.lifecycleState as any || null,
                                    isBotActive: customer.lifecycleState === 'ACTIVE_CLIENT' && customer.owner === 'BOT',
                                    isHandoffPending: false,
                                    isHumanAssigned: customer.lifecycleState === 'IN_PROGRESS',
                                    lastMessageAt: customer.lastMessageAt ? new Date(customer.lastMessageAt) : null,
                                    lastReadAt: customer.lastReadAt ? new Date(customer.lastReadAt) : null,
                                    lastInboundMessageAt: customer.lastInboundMessageAt ? new Date(customer.lastInboundMessageAt) : undefined,
                                    lastMessageDirection: customer.hasNewActivity ? 'inbound' : null,
                                    lastMessagePreview: customer.lastMessagePreview || null,
                                    unreadCount: 0,
                                    profileName: customer.profileName,
                                  });
                                  setChatDrawerOpen(true);
                                }}
                                className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                title="Abrir chat de WhatsApp"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                        
                        {/* Ubicación */}
                        {(customer.locality || customer.province) && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{[customer.locality, customer.province].filter(Boolean).join(', ')}</span>
                          </div>
                        )}

                        {/* Estado de conversación + info */}
                        {customer.hasActiveConversation && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
                            {/* Badge Nueva Actividad */}
                            {hasNewActivity && (
                              <div className="flex items-center gap-2 pt-0.5 pb-1">
                                <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                                <span className="text-sm font-bold text-blue-700">Nueva actividad!</span>
                              </div>
                            )}

                            {/* Indicadores de estado */}
                            {customer.lifecycleState === 'IN_PROGRESS' && customer.owner === 'OPERATOR' && (
                              <div className="flex items-center gap-1.5 text-sm text-amber-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>En atención</span>
                              </div>
                            )}
                            {customer.lifecycleState === 'ACTIVE_CLIENT' && (
                              <div className="flex items-center gap-1.5 text-sm text-blue-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span>Bot activo</span>
                              </div>
                            )}
                            {customer.lifecycleState === 'WAITING_CLIENT' && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                <span>Esperando</span>
                              </div>
                            )}

                            {/* Último mensaje */}
                            {customer.lastMessagePreview && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="truncate max-w-[200px]">{customer.lastMessagePreview}</span>
                                {customer.lastMessageAt && (
                                  <span className="shrink-0">{relativeTime(customer.lastMessageAt)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Primer contacto */}
                        <div className="mt-1.5 text-xs text-gray-400">
                          1er contacto {customer.createdAt ? relativeTime(customer.createdAt) : '-'}
                        </div>
                        
                        {/* Botón de seguimiento */}
                        {(() => {
                          const customerMark = marks?.find(m => m.targetId === customer.id);
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkForFollowUp('client', customer.id, customer.name || 'Cliente');
                              }}
                              className="mt-1.5 px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors"
                            >
                              {customerMark ? '✓ Seguimiento' : '⏰ Seguimiento'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
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
          conversationStatus={getConversationStatus(selectedLeadForChat) ?? null}
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
          onMarkAsRead={refetchCustomers}
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
                <h3 className="text-lg font-semibold text-gray-900">Confirmar descalificación</h3>
                <p className="text-sm text-gray-500">
                  ¿Marcar al lead <strong>{resolveConversationName}</strong> como descalificado?
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

      {/* Follow-up Mark Modal */}
      {followUpMarkModalOpen && followUpMarkTarget && (
        <MarkForFollowUpModal
          isOpen={followUpMarkModalOpen}
          onClose={() => {
            setFollowUpMarkModalOpen(false);
            setFollowUpMarkTarget(null);
          }}
          entityType={followUpMarkTarget.type}
          entityId={followUpMarkTarget.id}
          entityName={followUpMarkTarget.name}
          onSuccess={handleFollowUpMarkSuccess}
          createMark={createMark}
          deleteMarkFn={deleteMark}
        />
      )}
    </div>
  );
}
