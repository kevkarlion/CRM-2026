'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatMessage as ChatMessageType } from '../types/chat';

interface ChatPanelProps {
  messages: ChatMessageType[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (content: string) => void;
  onAttach?: (file: File) => Promise<void>;
  sending: boolean;
  selectedPhone: string | null;
}

export function ChatPanel({
  messages,
  loading,
  error,
  hasMore,
  onLoadMore,
  onSend,
  onAttach,
  sending,
  selectedPhone,
}: ChatPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages are loaded
  useEffect(() => {
    if (!selectedPhone || messages.length === 0) return;
    
    // Always scroll to bottom when messages arrive
    const scrollToBottom = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    };
    
    requestAnimationFrame(() => {
      setTimeout(scrollToBottom, 50);
    });
  }, [selectedPhone, messages.length]);

  if (!selectedPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50">
        <svg
          className="w-16 h-16 text-gray-300 mb-4"
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
        <p className="text-sm font-medium text-gray-900">Seleccioná una conversación</p>
        <p className="text-xs text-gray-500 mt-1">
          Elegí un chat de la lista para ver los mensajes
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* pb-20 = 80px to account for input area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {hasMore && messages.length > 0 && (
          <div className="text-center py-2">
            <button
              onClick={onLoadMore}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Cargar mensajes anteriores
            </button>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-10 w-48 bg-gray-200 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-xs text-danger-600">{error}</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg._id} message={msg} />
        ))}
      </div>

      <ChatInput 
        onSend={onSend} 
        onAttach={onAttach}
        disabled={!selectedPhone} 
        sending={sending} 
      />
    </div>
  );
}
