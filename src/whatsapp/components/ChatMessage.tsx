'use client';

import type { ChatMessage as ChatMessageType } from '../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusIcon({ status }: { status: ChatMessageType['status'] }) {
  if (status === 'failed') {
    return (
      <svg className="w-3.5 h-3.5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (status === 'pending') {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (status === 'sent') {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 13l4 4L11 11M7 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'read') {
    return (
      <svg className="w-3.5 h-3.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 13l4 4L11 11M7 13l4 4L19 7" />
      </svg>
    );
  }

  return null;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-brand-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {message.type !== 'text' && message.type !== 'unknown' && (
          <div className={`text-xs mb-1 ${isOutbound ? 'text-brand-100' : 'text-gray-500'}`}>
            [{message.type}]
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        <div
          className={`flex items-center gap-1 mt-1 ${
            isOutbound ? 'justify-end' : 'justify-start'
          }`}
        >
          <span
            className={`text-[10px] ${
              isOutbound ? 'text-brand-200' : 'text-gray-400'
            }`}
          >
            {formatTime(message.createdAt)}
          </span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
