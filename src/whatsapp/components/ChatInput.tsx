'use client';

import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  onAttach?: (file: File) => Promise<void>;
  disabled?: boolean;
  sending?: boolean;
}

export function ChatInput({ onSend, onAttach, disabled, sending }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    onSend(trimmed);
    setValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, sending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onAttach) return;

    const file = files[0];
    
    // Validar tipo
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de archivo no permitido. Solo se permiten imágenes y PDFs.');
      return;
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo excede el tamaño máximo de 10MB.');
      return;
    }

    setUploading(true);
    try {
      await onAttach(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir archivo. Intenta de nuevo.');
    } finally {
      setUploading(false);
      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onAttach]);

  const isActionDisabled = disabled || sending || uploading;

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        />
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={isActionDisabled}
          className="shrink-0 p-2.5 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Adjuntar archivo"
        >
          {uploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending || disabled}
          className="shrink-0 rounded-xl bg-brand-600 p-2.5 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
