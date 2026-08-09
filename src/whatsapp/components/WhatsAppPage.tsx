'use client';

import { useState, useCallback } from 'react';
import { LeadListPanel } from './LeadListPanel';
import { ChatPanel } from './ChatPanel';
import { LeadDataPanel } from './LeadDataPanel';
import { useChatLeads } from '../hooks/useChatLeads';
import { useChatMessages } from '../hooks/useChatMessages';
import { useWhatsAppSend } from '../hooks/useWhatsAppSend';
import { useChatPolling } from '../hooks/useChatPolling';
import type { ChatLead, ChatMessage as ChatMessageType } from '../types/chat';

export function WhatsAppPage() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ChatLead | null>(null);

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations,
    searchQuery,
    setSearchQuery,
  } = useChatLeads();

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    hasMore,
    loadMore,
    refetch: refetchMessages,
  } = useChatMessages(selectedPhone);

  const { sendMessage, downloadMedia, sending } = useWhatsAppSend();

  console.log('[WhatsAppPage] downloadMedia hook:', !!downloadMedia);
  console.log('[WhatsAppPage] handleDownload:', !!handleDownload);

  const handleSelectPhone = useCallback((phone: string) => {
    setSelectedPhone(phone);
    const conv = conversations.find((c) => c.phone === phone);
    if (conv?.leadId) {
      fetchLeadData(conv.leadId);
    } else {
      setSelectedLead(null);
    }
  }, [conversations]);

  const fetchLeadData = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        headers: {
          'x-tenant-id': localStorage.getItem('tenantId') || '',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLead(data);
      }
    } catch {
      setSelectedLead(null);
    }
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedPhone) return;

      const result = await sendMessage({
        phone: selectedPhone,
        content,
        leadId: selectedLead?._id,
      });

      if (result) {
        refetchMessages();
        refetchConversations();
      }
    },
    [selectedPhone, selectedLead, sendMessage, refetchMessages, refetchConversations]
  );

  const handleDownload = useCallback(
    async (messageId: string, filename: string) => {
      const result = await downloadMedia({
        messageId,
        filename,
        leadId: selectedLead?._id,
      });

      if (result.success) {
        refetchMessages();
      }
    },
    [selectedLead, downloadMedia, refetchMessages]
  );

  useChatPolling({
    interval: 5000,
    enabled: !!selectedPhone,
    onPoll: () => {
      refetchMessages();
      refetchConversations();
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 mt-16">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Centro de comandos de conversaciones
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile: show panels conditionally */}
        <div className="w-full flex md:hidden">
          {!selectedPhone ? (
            <div className="w-full">
              <LeadListPanel
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelect={handleSelectPhone}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                loading={conversationsLoading}
              />
            </div>
          ) : (
            <div className="w-full flex flex-col h-full">
              <div className="px-4 py-2 border-b border-gray-200 bg-white shrink-0 mt-16">
                <button
                  onClick={() => setSelectedPhone(null)}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Volver
                </button>
              </div>
              <ChatPanel
                messages={messages}
                loading={messagesLoading}
                error={messagesError}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onSend={handleSend}
                onDownload={handleDownload}
                sending={sending}
                selectedPhone={selectedPhone}
                leadId={selectedLead?._id}
              />
            </div>
          )}
        </div>

        {/* Tablet: 2 panels */}
        <div className="hidden md:flex lg:hidden w-full">
          <div className="w-72 shrink-0">
            <LeadListPanel
              conversations={conversations}
              selectedPhone={selectedPhone}
              onSelect={handleSelectPhone}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={conversationsLoading}
            />
          </div>
          <div className="flex-1 flex flex-col">
            <ChatPanel
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSend={handleSend}
              onDownload={handleDownload}
              sending={sending}
              selectedPhone={selectedPhone}
              selectedName={selectedLead?.name}
              leadId={selectedLead?._id}
            />
          </div>
        </div>

        {/* Desktop: 3 panels */}
        <div className="hidden lg:flex w-full">
          <div className="w-80 shrink-0">
            <LeadListPanel
              conversations={conversations}
              selectedPhone={selectedPhone}
              onSelect={handleSelectPhone}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={conversationsLoading}
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <ChatPanel
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSend={handleSend}
              onDownload={handleDownload}
              sending={sending}
              selectedPhone={selectedPhone}
              selectedName={selectedLead?.name}
              leadId={selectedLead?._id}
            />
          </div>
          <div className="w-72 shrink-0">
            <LeadDataPanel lead={selectedLead} />
          </div>
        </div>
      </div>
    </div>
  );
}
