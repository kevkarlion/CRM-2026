'use client';

import { useState, useCallback } from 'react';
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

/**
 * Componente para mostrar imagen con miniatura y modal de vista previa
 */
function ImageMessage({ 
  url, 
  caption, 
  isOutbound 
}: { 
  url?: string; 
  caption?: string; 
  isOutbound: boolean;
}) {
  const [showModal, setShowModal] = useState(false);

  if (!url) {
    return (
      <div className={`text-xs ${isOutbound ? 'text-brand-100' : 'text-gray-500'}`}>
        🖼️ Imagen
      </div>
    );
  }

  return (
    <>
      <div className="mt-1">
        <img
          src={url}
          alt={caption || 'Imagen'}
          className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setShowModal(true)}
          loading="lazy"
        />
        {caption && (
          <p className={`text-sm mt-1 ${isOutbound ? 'text-brand-50' : 'text-gray-700'}`}>
            {caption}
          </p>
        )}
      </div>

      {/* Modal de vista previa */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={url}
              alt={caption || 'Imagen'}
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Componente para mostrar documento (PDF u otro)
 */
function DocumentMessage({ 
  filename, 
  url, 
  caption,
  isOutbound 
}: { 
  filename?: string; 
  url?: string;
  caption?: string;
  isOutbound: boolean;
}) {
  const displayName = filename || caption || 'Documento';
  const isPdf = filename?.toLowerCase().endsWith('.pdf') || filename?.toLowerCase().includes('pdf');

  if (!url) {
    return (
      <div className={`flex items-center gap-2 text-sm ${isOutbound ? 'text-brand-100' : 'text-gray-700'}`}>
        <span>📄</span>
        <span>{displayName}</span>
      </div>
    );
  }

  return (
    <div className={`mt-1 p-2 rounded-lg ${isOutbound ? 'bg-brand-500/20' : 'bg-gray-100'}`}>
      <div className="flex items-center gap-3">
        {isPdf ? (
          <svg className="w-8 h-8 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isOutbound ? 'text-brand-50' : 'text-gray-900'}`}>
            {displayName}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1.5 rounded-lg transition-colors ${
              isOutbound 
                ? 'text-brand-100 hover:bg-brand-500/30' 
                : 'text-gray-500 hover:bg-gray-200'
            }`}
            title="Ver"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </a>
          <a
            href={url}
            download={displayName}
            className={`p-1.5 rounded-lg transition-colors ${
              isOutbound 
                ? 'text-brand-100 hover:bg-brand-500/30' 
                : 'text-gray-500 hover:bg-gray-200'
            }`}
            title="Descargar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';

  // Extraer URLs de multimedia desde metadata
  const mediaUrl = message.metadata?.cloudinaryUrl || 
                   (message.content.startsWith('http') ? message.content : undefined);
  const mediaFilename = message.metadata?.filename || 
                       (message.type === 'document' ? message.content.replace('[Documento: ', '').replace(']', '') : undefined);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-brand-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {/* Mensajes multimedia */}
        {message.type === 'image' && (
          <ImageMessage 
            url={mediaUrl}
            caption={message.metadata?.caption}
            isOutbound={isOutbound}
          />
        )}

        {(message.type === 'document' || message.type === 'video') && (
          <DocumentMessage
            filename={mediaFilename}
            url={mediaUrl}
            caption={message.metadata?.caption}
            isOutbound={isOutbound}
          />
        )}

        {/* Mensajes de texto o otros tipos sin multimedia */}
        {(message.type === 'text' || message.type === 'interactive' || message.type === 'unknown') && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {/* Solo mostrar label para tipos especiales si no hay contenido visual */}
        {message.type === 'audio' && (
          <div className={`flex items-center gap-2 text-sm ${isOutbound ? 'text-brand-100' : 'text-gray-500'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Audio</span>
          </div>
        )}

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
