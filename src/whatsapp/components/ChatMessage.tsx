'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import type { ChatMessage as ChatMessageType } from '../types/chat';

/**
 * Cache de URLs de audio ya descargadas, por messageId.
 * Evita que el refetch de mensajes (que re-monta cada AudioMessage) vuelva a
 * descargar el audio y/o dispare un loop de descarga+refetch que deja las
 * "3 pelotitas" cargando hasta refrescar la página.
 */
const audioUrlCache = new Map<string, string>();

interface ChatMessageProps {
  message: ChatMessageType;
  /**
   * Descarga media on-demand. Debe resolver con la cloudinaryUrl del archivo
   * cuando está disponible (para poder reproducirlo sin esperar el refetch).
   */
  onDownload?: (messageId: string, filename: string) => Promise<string | void>;
  clientId?: string;
  leadId?: string;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatea segundos a m:ss (0:43, 1:05). */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusIcon({ status }: { status: ChatMessageType['status'] }) {
  if (status === 'failed') {
    return (
      <svg className="w-3.5 h-3.5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (status === 'pending') {
    return (
      <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (status === 'sent') {
    return (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 13l4 4L11 11M7 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'read') {
    return (
      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M1 13l4 4L11 11M7 13l4 4L19 7" />
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
            target="_blank"
            rel="noopener noreferrer"
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

/**
 * Reproductor de audio estilo WhatsApp usando wavesurfer.js.
 * Renderiza la onda real del audio (trazo continuo y suave), con play/pausa
 * al hacer clic en la onda (interact) y un botón custom a la izquierda.
 */
function AudioWavePlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState<{ currentTime: number; duration: number }>({
    currentTime: 0,
    duration: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;

    const waveColor = isOutbound ? 'rgba(255,255,255,0.55)' : 'rgba(17,24,39,0.30)';
    const progressColor = isOutbound ? '#ffffff' : '#111827';

    const ws = WaveSurfer.create({
      container: el,
      url: src,
      height: 40,
      width: '100%',
      waveColor,
      progressColor,
      cursorColor: 'transparent',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      fillParent: true,
      interact: true,
    });

    wsRef.current = ws;

    const s = ws.getState();
    const unsubs = [
      s.isPlaying.subscribe(setPlaying),
      s.currentTime.subscribe((t) => setState((prev) => ({ ...prev, currentTime: t }))),
      s.duration.subscribe((d) => setState((prev) => ({ ...prev, duration: d }))),
    ];

    const onReady = () => {
      // La onda cargó. No logueamos para no ensuciar (puede haber varios audios).
    };
    const onError = () => {
      // Si falla la carga del audio, no dejamos la UI colgada.
      console.error('[wavesurfer] error al cargar audio');
      setPlaying(false);
    };
    ws.on('ready', onReady);
    ws.on('error', onError);

    return () => {
      unsubs.forEach((u) => u());
      ws.un('ready', onReady);
      ws.un('error', onError);
      ws.destroy();
      wsRef.current = null;
    };
  }, [src, isOutbound]);

  const toggle = () => {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.isPlaying()) ws.pause();
    else void ws.play();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
        className={`shrink-0 rounded-full p-2 transition-colors ${
          isOutbound ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div
        ref={containerRef}
        className="flex-1 min-w-0 cursor-pointer"
        style={{ minWidth: '140px', maxWidth: '220px' }}
      />
      {state.duration > 0 && (
        <span className={`text-xs shrink-0 tabular-nums ${isOutbound ? 'text-white/80' : 'text-gray-500'}`}>
          {/* WhatsApp: al inicio muestra la duración total; al reproducir, el
              tiempo transcurrido. Sin progreso aún → duración. */}
          {formatDuration(playing || state.currentTime > 0 ? state.currentTime : state.duration)}
        </span>
      )}
    </div>
  );
}

/**
 * Componente para reproducir audio en el chat.
 * Quiere dejar el reproductor <audio> siempre visible en la ventana.
 * - Si ya hay cloudinaryUrl → player directo.
 * - Si no, descarga automáticamente al montar (vía onDownload) y muestra el
 *   player apenas se tiene la URL. Mientras carga → breve indicador.
 * - Si falla (audio fuera de la ventana de 24h de WhatsApp) → mensaje claro.
 */
function AudioMessage({
  message,
  isOutbound,
  onDownload,
}: {
  message: ChatMessageType;
  isOutbound: boolean;
  onDownload?: (messageId: string, filename: string) => Promise<string | void>;
}) {
  // Priorizamos la URL ya descargada en esta sesión (cache) para que, cuando el
  // refetch re-monte este componente, no vuelva a la pantalla de "cargando".
  const cachedUrl = message.messageId ? audioUrlCache.get(message.messageId) : undefined;
  const [loading, setLoading] = useState(
    !(message.metadata?.cloudinaryUrl ?? cachedUrl) && !!message.metadata?.mediaId,
  );
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | undefined>(
    message.metadata?.cloudinaryUrl ?? cachedUrl,
  );
  const [retryKey, setRetryKey] = useState(0);
  const attempted = useRef<boolean>(
    !!(message.metadata?.cloudinaryUrl ?? cachedUrl) || !message.metadata?.mediaId,
  );

  // Sincroniza el estado local con el mensaje: si el prop trae cloudinaryUrl
  // (el polling refrescó y el backend ya persistió la URL) o el cache de otra
  // ventana ya la tiene, actualizamos src para que el audio deje de mostrar
  // "pelotitas" y muestre la onda.
  useEffect(() => {
    const latestUrl = message.metadata?.cloudinaryUrl ?? audioUrlCache.get(message.messageId);
    if (latestUrl && latestUrl !== src) {
      setSrc(latestUrl);
      setLoading(false);
      setError(null);
    }
  }, [message.messageId, message.metadata?.cloudinaryUrl, src]);

  // Descarga automática al montar si el audio no tiene URL pero sí mediaId.
  useEffect(() => {
    if (src || attempted.current || !message.metadata?.mediaId || !onDownload) return;
    const messageId = message.messageId;
    const filename = message.metadata?.filename || `audio_${message.createdAt}.ogg`;
    attempted.current = true;
    setLoading(true);
    setError(null);

    let cancelled = false;
    (async () => {
      try {
        const url = await onDownload(messageId, filename);
        // Guardamos en el cache ANTES de comprobar cancelación: aunque este
        // montaje se desmonte (refetch del polling re-monta), la URL queda
        // disponible para que el siguiente montaje del mismo mensaje la lea y
        // muestre el player sin volver a descargar ni quedar colgado.
        if (url) audioUrlCache.set(messageId, url);
        if (cancelled) return;
        if (url) {
          setSrc(url);
        } else {
          setError('Audio no disponible (podría estar vencido: solo se puede descargar dentro de 24h).');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[audio] error al descargar', e);
          setError('Error al cargar el audio');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message.messageId, message.createdAt, message.metadata?.filename, message.metadata?.mediaId, onDownload, src, retryKey]);

  const handleRetry = () => setRetryKey((k) => k + 1);

  // Tiene player disponible → mostrar reproductor tipo WhatsApp (play + onda).
  if (src) {
    return (
      <div className="mt-1 w-full">
        <AudioWavePlayer src={src} isOutbound={isOutbound} />
      </div>
    );
  }

  // Cargando la descarga → indicador breve con 3 puntitos.
  if (loading) {
    return (
      <div className="mt-1 w-full">
        <div className={`flex items-center gap-1.5 text-sm ${isOutbound ? 'text-brand-100' : 'text-gray-500'}`}>
          <span>🎤</span>
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
          </span>
        </div>
      </div>
    );
  }

  // No descargable o falló.
  return (
    <div className="mt-1 w-full">
      <div className="flex flex-col gap-1">
        <span className={`text-sm ${isOutbound ? 'text-brand-100' : 'text-gray-500'}`}>🎤 Audio</span>
        {error && (
          <span className={`text-xs flex items-center gap-1 ${isOutbound ? 'text-brand-100' : 'text-red-500'}`}>
            {error}
            <button
              type="button"
              onClick={handleRetry}
              className={`underline hover:opacity-80 ${isOutbound ? 'text-brand-100' : 'text-red-600'}`}
            >
              Reintentar
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatMessage({ message, onDownload, clientId, leadId }: ChatMessageProps) {
  const isOutbound = message.direction === 'outbound';
  const [downloading, setDownloading] = useState(false);
  const [showDownloadInput, setShowDownloadInput] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('');

  // Extraer URLs de multimedia desde metadata
  const mediaUrl = message.metadata?.cloudinaryUrl || 
                   (message.content.startsWith('http') ? message.content : undefined);
  const mediaFilename = message.metadata?.filename || 
                        (message.type === 'document' ? message.content.replace('[Documento: ', '').replace(']', '') : undefined);
  
  // Verificar si hay multimedia pendiente de descarga
  // Condición: es documento/entrada, tiene mediaId, y NO tiene cloudinaryUrl (no se ha descargado)
  const isMediaType = message.type === 'document' || message.type === 'image' || message.type === 'video' || message.type === 'audio';
  const pendingDownload = isMediaType 
    && !!message.metadata?.mediaId 
    && !message.metadata?.cloudinaryUrl;

  const hasMediaId = !!message.metadata?.mediaId;

  const handleDownloadClick = () => {
    // Prellenar con el nombre original del archivo
    setDownloadFilename(mediaFilename || '');
    setShowDownloadInput(true);
  };

  const handleDownloadConfirm = async () => {
    if (!downloadFilename.trim() || !onDownload) {
      return;
    }
    
    setDownloading(true);
    try {
      await onDownload(message.messageId, downloadFilename.trim());
      setShowDownloadInput(false);
    } catch (err) {
      console.error('[ChatMessage] Error al descargar:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Si hay multimedia pendiente de descarga, mostrar UI especial
  // (es tipo multimedia, tiene mediaId, y no tiene cloudinaryUrl = no descargado)
  // Excluimos audio: su flujo es reproducir (AudioMessage → descarga on-demand),
  // no "guardar en documentos".
  if (pendingDownload && !isOutbound && message.type !== 'audio') {
    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-3 ${
            isOutbound
              ? 'bg-brand-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          {/* Indicador de archivo recibido */}
          <div className="flex items-center gap-2 mb-2">
            {message.type === 'image' ? (
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span className="text-sm font-medium">
              {message.metadata?.caption || message.content}
            </span>
          </div>

          {/* Mostrar input para nombre si está abierto */}
          {showDownloadInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value)}
                placeholder="Nombre del archivo"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadConfirm}
                  disabled={downloading || !downloadFilename.trim()}
                  className="flex-1 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading ? 'Descargando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setShowDownloadInput(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDownloadClick}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Guardar en documentos</span>
            </button>
          )}

          {/* Timestamp */}
          <div className={`flex items-center gap-1 mt-2 text-xs ${isOutbound ? 'text-brand-200' : 'text-gray-400'}`}>
            <span>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3 md:px-4 py-2 ${
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

        {/* Mensajes de audio: player directo o descarga on-demand */}
        {message.type === 'audio' && (
          <AudioMessage
            message={message}
            isOutbound={isOutbound}
            onDownload={onDownload}
          />
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
