'use client';

import { EntityTab, EntityTabPanel, EntityTabs } from '@/components/entity-detail';
import { ChatPanel } from '@/whatsapp/components/ChatPanel';
import { LeadTimeline } from '@/activity/components/LeadTimeline';
import { useWhatsAppSend } from '@/whatsapp/hooks/useWhatsAppSend';
import { useChatMessages } from '@/whatsapp/hooks/useChatMessages';
import type { ChatMessage } from '@/whatsapp/types/chat';

export type ActivityTabId = 'chat' | 'timeline';

interface LeadActivityTabsProps {
  activeTab: ActivityTabId;
  onActiveTabChange: (tab: ActivityTabId) => void;
  leadId: string;
  phone: string | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  hasMore: boolean;
  chatSending: boolean;
  onLoadMore: () => void;
  onSendChat: (content: string) => void;
  onAttachChat?: (file: File) => void;
  onDownloadChat?: (messageId: string, filename: string) => Promise<void>;
  handoffPending: boolean;
  timelineRefreshKey: number;
}

/** Inner Chat WhatsApp / Actividad tabs rendered inside the Resumen tab. */
export function LeadActivityTabs({
  activeTab,
  onActiveTabChange,
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
  timelineRefreshKey,
}: LeadActivityTabsProps) {
  return (
    <EntityTabs
      activeId={activeTab}
      onChange={(id) => onActiveTabChange(id as ActivityTabId)}
      aria-label="Comunicación y actividad del lead"
    >
      <EntityTab
        id="chat"
        label="Chat WhatsApp"
        icon={
          handoffPending ? (
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />
          ) : undefined
        }
      />
      <EntityTab id="timeline" label="Actividad" />

      <EntityTabPanel id="chat" className="h-[calc(100vh-320px)] md:h-[500px] p-0">
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
      </EntityTabPanel>

      <EntityTabPanel id="timeline" className="p-6">
        <LeadTimeline leadId={leadId} refreshKey={timelineRefreshKey} />
      </EntityTabPanel>
    </EntityTabs>
  );
}
