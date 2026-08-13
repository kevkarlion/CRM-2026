'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import { useChatPolling } from '@/whatsapp/hooks/useChatPolling';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { TimelineTab } from './TimelineTab';
import type { Temperature } from '@/leads/types/lead';
import type { ChatMessage } from '@/whatsapp/types/chat';

interface ClientChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: { id: string; name: string; phone: string } | null;
  conversationStatus?: ConversationStatus | null;
}

const TEMPERATURE_CONFIG: Record<string, { icon: string; className: string }> = {
  hot: { icon: '🔥', className: 'bg-red-100 text-red-700 border-red-200' },
  warm: { icon: '🟡', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  cold: { icon: '❄️', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

type TabType = 'chat' | 'timeline';

export function ClientChatDrawer({ isOpen, onClose, client, conversationStatus }: ClientChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const router = useRouter();

  // Mark conversation as read when drawer opens
  useEffect(() => {
    if (isOpen && conversationStatus?.conversationId) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      fetch(`/api/crm/conversations/${conversationStatus.conversationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      }).catch(() => {
        // Silent fail - not critical
      });
    }
  }, [isOpen, conversationStatus?.conversationId]);

  const phone = client?.phone || '';

  // Score del cliente desde conversationStatus o valor por defecto
  const displayScore = conversationStatus?.score ?? 0;
  const displayTemperature = (conversationStatus?.temperature as Temperature) || 'cold';

  const {
    messages,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useChatMessages(phone);

  const { sendMessage, sendMedia, downloadMedia, sending } = useWhatsAppSend();

  // Polling para nuevos mensajes
  useChatPolling({
    interval: 5000,
    enabled: isOpen,
    onPoll: refetch,
  });

  if (!isOpen || !client) return null;

  const handleSend = async (content: string) => {
    if (!phone) return;
    const result = await sendMessage({
      phone,
      content,
      leadId: client.id,
    });
    if (result) {
      refetch();
    }
  };

  const handleAttach = async (file: File) => {
    if (!phone) return;
    const result = await sendMedia({
      file,
      to: phone,
      leadId: client.id,
    });
    if (result) {
      refetch();
    }
  };

  const handleDownload = async (messageId: string, filename: string) => {
    if (!phone) return;
    await downloadMedia({
      messageId,
      filename,
      leadId: client.id,
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white shrink-0 mt-16">
          <div className="flex items-start justify-between p-4 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-lg">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate">{client.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {displayTemperature && TEMPERATURE_CONFIG[displayTemperature] && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TEMPERATURE_CONFIG[displayTemperature].className}`}>
                      {TEMPERATURE_CONFIG[displayTemperature].icon} {displayScore} pts
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-0 flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Actividad
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {activeTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSend={handleSend}
              onAttach={handleAttach}
              onDownload={handleDownload}
              sending={sending}
              selectedPhone={phone}
              leadId={client.id}
            />
          ) : activeTab === 'timeline' ? (
            <TimelineTab
              messages={messages.map((m) => ({
                content: m.content,
                direction: m.direction,
                createdAt: m.createdAt,
                type: m.type,
              }))}
              conversationStatus={conversationStatus || {
                conversationId: '',
                leadId: client.id,
                hasActiveConversation: false,
                conversationState: null,
                isBotActive: false,
                isHandoffPending: false,
                isHumanAssigned: false,
                lastMessageAt: null,
                lastMessagePreview: null,
                unreadCount: 0,
              }}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}