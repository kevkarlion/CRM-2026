'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api-client';
import type { ConversationState } from '@/conversation/domain/conversation';

export interface ConversationStatus {
  conversationId: string;
  leadId: string;
  hasActiveConversation: boolean;
  conversationState: ConversationState | null;
  isBotActive: boolean;
  isHandoffPending: boolean;
  isHumanAssigned: boolean;
  handoffReason?: string;
  lastMessageAt: Date | null;
  lastReadAt: Date | null;
  lastMessageDirection: 'inbound' | 'outbound' | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  score?: number;
  temperature?: string;
  context?: Record<string, unknown>;
}

const BOT_ACTIVE_STATES = new Set<string>([
  'greeting',
  'need_type_asked',
  'need_type_captured',
  'detail_asked',
  'detail_captured',
  'customer_type_asked',
  'customer_type_captured',
  'urgency_asked',
  'urgency_captured',
  'location_asked',
  'location_captured',
  'equipment_asked',
  'equipment_captured',
  'evaluate',
  'scored',
  'idle', // Bot está esperandoinput
  'address',
  'priority',
  'description',
  'service',
  'confirmation',
]);

interface ConversationWithLead {
  _id: string;
  tenantId: string;
  leadId: string;
  state: string;
  previousState?: string;
  handoffStatus?: string;
  handoffReason?: string;
  assignedToUserId?: string;
  lastMessageAt: Date;
  startedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  lead: {
    _id: string;
    name: string;
    phone?: string;
    status: string;
    temperature?: string;
    score?: number;
    inquiryReason?: string;
    customerType?: string;
  } | null;
  lastMessage?: {
    content: string;
    direction: string;
    createdAt: Date;
  };
}

export function useConversationStatus(leadIds: string[]) {
  const [statusMap, setStatusMap] = useState<Map<string, ConversationStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leadIdsKey = useMemo(() => leadIds.sort().join(','), [leadIds]);
  const previousKeyRef = useRef(leadIdsKey);

  const fetchStatuses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.get<{ conversations: ConversationWithLead[] }>(
        '/api/crm/conversations',
        { limit: '200' }
      );

      const map = new Map<string, ConversationStatus>();

      for (const conv of result.conversations) {
        if (!conv.leadId) continue;

        const state = conv.state as ConversationState;
        const isBotActive = conv.owner === 'BOT' && (
          BOT_ACTIVE_STATES.has(state) || 
          conv.lifecycleState === 'WAITING_OPERATOR' || 
          conv.lifecycleState === 'WAITING_CLIENT'
        );
        const isHandoffPending = conv.handoffStatus === 'pending';
        const isHumanAssigned = conv.handoffStatus === 'assigned' || state === 'human_assigned' || state === 'IN_PROGRESS';

        const lastMsg = conv.lastMessage;
        const preview = lastMsg
          ? lastMsg.content.length > 60
            ? lastMsg.content.slice(0, 60) + '...'
            : lastMsg.content
          : null;

        // Use stringified leadId as key to match PipelineBoard's lookup
        const leadIdKey = String(conv.leadId);
        
        map.set(leadIdKey, {
          conversationId: conv._id,
          leadId: conv.leadId,
          hasActiveConversation: true,
          conversationState: state,
          isBotActive,
          isHandoffPending,
          isHumanAssigned,
          handoffReason: conv.handoffReason,
          lastMessageAt: lastMsg ? new Date(lastMsg.createdAt) : (conv.lastMessageAt ? new Date(conv.lastMessageAt) : null),
          lastReadAt: conv.lastReadAt ? new Date(conv.lastReadAt) : null,
          lastMessageDirection: lastMsg?.direction === 'inbound' ? 'inbound' : (lastMsg?.direction === 'outbound' ? 'outbound' : null),
          lastMessagePreview: preview,
          unreadCount: 0,
          score: conv.lead?.score,
          temperature: conv.lead?.temperature,
        });
      }

      setStatusMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStatuses();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  return { statusMap, loading, error, refetch: fetchStatuses };
}
