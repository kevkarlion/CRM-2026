'use client';

import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import type { ChatMessage } from '@/whatsapp/types/chat';

interface LeadActivityTabsProps {
  leadId: string;
  phone: string | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  hasMore: boolean;
  chatSending: boolean;
  onLoadMore: () => void;
  onSendChat: (content: string) => void;
  onAttachChat?: (file: File) => Promise<void>;
  onDownloadChat?: (messageId: string, filename: string) => Promise<string | void>;
  handoffPending: boolean;
}

/** Chat WhatsApp panel rendered inside the Resumen tab. */
export function LeadActivityTabs({
  leadId,
  phone,
  messages,
  chatLoading,
  chatError,
  hasMore,
  chatSending,
  onLoadMore,
  onSendChat,
  onAttachChat,
  onDownloadChat,
  handoffPending,
}: LeadActivityTabsProps) {
  return (
    <div className="h-[calc(100vh-320px)] md:h-[500px] overflow-hidden rounded-lg border border-gray-200">
      <ChatPanel
        messages={messages}
        loading={chatLoading}
        error={chatError}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onSend={onSendChat}
        onAttach={onAttachChat}
        onDownload={onDownloadChat}
        sending={chatSending}
        selectedPhone={phone}
        leadId={leadId}
      />
    </div>
  );
}
