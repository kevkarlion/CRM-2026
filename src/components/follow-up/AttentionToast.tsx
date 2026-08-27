'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AttentionToastProps {
  className?: string;
}

interface ToastItem {
  _id: string;
  id: string;
  name: string;
  type: 'lead' | 'client';
  markedBy: string;
  markedAt: string;
}

/**
 * AttentionToast - Real-time toast notifications for follow-up marks
 * 
 * Uses SSE (Server-Sent Events) via EventSource for real-time updates.
 * No polling, no intervals - events are pushed instantly when a user
 * is marked for follow-up attention.
 */
export function AttentionToast({ className = '' }: AttentionToastProps) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectedRef = useRef(false);
  const userEmailRef = useRef<string | null>(null);

  // Get current user email
  const getUserEmail = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email;
    } catch {
      return null;
    }
  }, []);

  // Mark toast as seen in localStorage
  const markAsSeen = useCallback((markId: string) => {
    const userEmail = getUserEmail();
    if (!userEmail) return;
    const seenKey = `atencion_seen_${userEmail}`;
    const seenIds: string[] = JSON.parse(localStorage.getItem(seenKey) || '[]');
    if (!seenIds.includes(markId)) {
      seenIds.push(markId);
      localStorage.setItem(seenKey, JSON.stringify(seenIds));
    }
  }, [getUserEmail]);

  // Handle incoming SSE event
  const handleSSEEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Skip connection/keep-alive events
      if (data.status === 'connected') {
        console.log('[AttentionToast] SSE connected');
        return;
      }

      // Only show toast if it's for the current user
      const currentUserEmail = getUserEmail();
      if (data.userEmail !== currentUserEmail) {
        return;
      }

      // Check if already seen
      const seenKey = `atencion_seen_${currentUserEmail}`;
      const seenIds: string[] = JSON.parse(localStorage.getItem(seenKey) || '[]');
      if (seenIds.includes(data.markId)) {
        return;
      }

      // Add to toasts
      const toastItem: ToastItem = {
        _id: data.markId,
        id: data.targetId,
        name: data.targetName || 'Elemento sin nombre',
        type: data.targetType || 'lead',
        markedBy: data.markedBy || 'Unknown',
        markedAt: data.markedAt,
      };

      setToasts((prev) => [...prev, toastItem]);
    } catch (error) {
      console.error('[AttentionToast] Failed to parse SSE event:', error);
    }
  }, [getUserEmail]);

  // Set up SSE connection on mount
  useEffect(() => {
    if (isConnectedRef.current) return;

    // Prevent double connection in React StrictMode
    if (typeof window === 'undefined') return;

    // Store user email for comparison in events
    userEmailRef.current = getUserEmail();

    const connectSSE = () => {
      try {
        const eventSource = new EventSource('/api/sse/attention-marks');
        eventSourceRef.current = eventSource;

        // Listen for attentionMarkAdded event
        eventSource.addEventListener('attentionMarkAdded', handleSSEEvent as EventListener);

        // Also handle default message events (fallback)
        eventSource.onmessage = handleSSEEvent;

        eventSource.onerror = (error) => {
          console.error('[AttentionToast] SSE connection error:', error);
          eventSource.close();
          eventSourceRef.current = null;
          isConnectedRef.current = false;

          // Reconnect after 5 seconds
          setTimeout(() => {
            if (!isConnectedRef.current) {
              connectSSE();
            }
          }, 5000);
        };

        eventSource.onopen = () => {
          console.log('[AttentionToast] SSE connection opened');
          isConnectedRef.current = true;
        };
      } catch (error) {
        console.error('[AttentionToast] Failed to connect SSE:', error);
      }
    };

    connectSSE();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [getUserEmail, handleSSEEvent]);

  const handleToastClick = useCallback((toast: ToastItem) => {
    markAsSeen(toast._id);
    if (toast.type === 'lead') {
      router.push(`/leads/${toast.id}`);
    } else {
      router.push(`/clients/${toast.id}`);
    }
    setToasts((prev) => prev.filter((t) => t._id !== toast._id));
  }, [router, markAsSeen]);

  const handleDismiss = useCallback((toast: ToastItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsSeen(toast._id);
    setToasts((prev) => prev.filter((t) => t._id !== toast._id));
  }, [markAsSeen]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-md w-full mx-4">
      {toasts.slice(0, 1).map((toast) => (
        <div
          key={toast._id}
          onClick={() => handleToastClick(toast)}
          className="bg-amber-50 border border-amber-200 rounded-xl shadow-lg p-4 cursor-pointer hover:bg-amber-100 transition-all animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
              ⏰
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                {toast.name}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Te marcaron para seguimiento
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {new Date(toast.markedAt).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={(e) => handleDismiss(toast, e)}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-amber-400 hover:text-amber-600 hover:bg-amber-200 rounded-full transition-colors"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
