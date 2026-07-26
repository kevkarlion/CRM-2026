'use client';

import type { ChatConversation } from '../types/chat';

interface ChatLeadItemProps {
  conversation: ChatConversation;
  isSelected: boolean;
  onSelect: (phone: string) => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}m`;
}

export function ChatLeadItem({ conversation, isSelected, onSelect }: ChatLeadItemProps) {
  const { phone, leadName, lastMessage, unreadCount, lastActivity } = conversation;

  return (
    <button
      onClick={() => onSelect(phone)}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-brand-50 border-l-2 border-l-brand-600' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {leadName || phone}
            </p>
            {unreadCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-brand-600 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {leadName && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{phone}</p>
          )}

          <p className="text-xs text-gray-500 truncate mt-1">
            {lastMessage.direction === 'outbound' && (
              <span className="text-gray-400">Tú: </span>
            )}
            {lastMessage.content}
          </p>
        </div>

        <span className="shrink-0 text-[10px] text-gray-400 mt-0.5">
          {relativeTime(lastActivity)}
        </span>
      </div>
    </button>
  );
}
