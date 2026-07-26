'use client';

import { ChatLeadItem } from './ChatLeadItem';
import type { ChatConversation } from '../types/chat';

interface LeadListPanelProps {
  conversations: ChatConversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
}

export function LeadListPanel({
  conversations,
  selectedPhone,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}: LeadListPanelProps) {
  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Conversaciones</h2>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <svg
              className="w-10 h-10 text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-900">Sin conversaciones</p>
            <p className="text-xs text-gray-500 mt-1">
              No hay chats de WhatsApp aún
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ChatLeadItem
              key={conv.phone}
              conversation={conv}
              isSelected={conv.phone === selectedPhone}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
