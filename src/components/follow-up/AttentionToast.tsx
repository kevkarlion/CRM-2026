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

interface FollowUpMarkResponse {
  _id: string;
  leadId?: { _id: string; name?: string; profileName?: string };
  clientId?: { _id: string; fullName?: string; profileName?: string; companyName?: string };
  markedBy: string;
  assignedTo: string;
  markedAt: string;
  note?: string;
}

/**
 * AttentionToast - Toast notifications for follow-up marks
 * 
 * Hybrid approach:
 * 1. SSE for real-time updates (primary)
 * 2. Polling as fallback when SSE fails or for cross-Lambda reliability
 * 
 * Polling is more reliable in serverless environments (Vercel) where
 * SSE connections may land on different Lambda instances than the POST request.
 */
export function AttentionToast({ className = '' }: AttentionToastProps) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectedRef = useRef(false);
  const userEmailRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPolledRef = useRef<number>(0);

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

  // Check if already seen
  const isAlreadySeen = useCallback((markId: string): boolean => {
    const userEmail = getUserEmail();
    if (!userEmail) return true;
    const seenKey = `atencion_seen_${userEmail}`;
    const seenIds: string[] = JSON.parse(localStorage.getItem(seenKey) || '[]');
    return seenIds.includes(markId);
  }, [getUserEmail]);

  // Show toast for a mark
  const showToastForMark = useCallback((mark: FollowUpMarkResponse) => {
    if (isAlreadySeen(mark._id)) return;

    // Only show if it's for current user (case-insensitive)
    const currentUserEmail = (userEmailRef.current || getUserEmail() || '').toLowerCase();
    const markAssignedTo = (mark.assignedTo || '').toLowerCase();
    
    if (markAssignedTo !== currentUserEmail) {
      console.log(`[AttentionToast] Skipping mark - mark for ${mark.assignedTo}, current user is ${currentUserEmail}`);
      return;
    }

    // Extract target info
    let targetId = '';
    let targetName = 'Elemento sin nombre';
    let targetType: 'lead' | 'client' = 'lead';

    if (mark.leadId) {
      targetId = typeof mark.leadId === 'object' ? (mark.leadId as any)._id : mark.leadId;
      const lead = mark.leadId as any;
      targetName = lead.profileName || lead.name || 'Lead sin nombre';
      targetType = 'lead';
    } else if (mark.clientId) {
      targetId = typeof mark.clientId === 'object' ? (mark.clientId as any)._id : mark.clientId;
      const client = mark.clientId as any;
      targetName = client.profileName || client.fullName || client.companyName || 'Cliente sin nombre';
      targetType = 'client';
    }

    const toastItem: ToastItem = {
      _id: mark._id,
      id: targetId,
      name: targetName,
      type: targetType,
      markedBy: mark.markedBy,
      markedAt: mark.markedAt,
    };

    setToasts((prev) => [...prev, toastItem]);
  }, [isAlreadySeen, getUserEmail]);

  // Polling fetch - fallback when SSE doesn't work (Lambda mismatch)
  const fetchNewMarks = useCallback(async () => {
    const userEmail = userEmailRef.current || getUserEmail();
    if (!userEmail) {
      console.log('[AttentionToast] ❌ No user email, skipping poll');
      return;
    }

    console.log('[AttentionToast] 🔄 Polling for:', userEmail);

    // Don't poll if we already polled recently (within 10 seconds)
    const now = Date.now();
    if (now - lastPolledRef.current < 10000) return;
    lastPolledRef.current = now;

    try {
      const encodedEmail = encodeURIComponent(userEmail);
      const response = await fetch(`/api/follow-up-marks?userEmail=${encodedEmail}`);
      
      if (!response.ok) {
        console.warn('[AttentionToast] Polling failed:', response.status);
        return;
      }

      const marks: FollowUpMarkResponse[] = await response.json();
      
      console.log('[AttentionToast] 📥 Got', marks.length, 'marks');
      
      if (!Array.isArray(marks) || marks.length === 0) return;

      // Check each mark - show toast for unseen ones
      for (const mark of marks) {
        const markDate = new Date(mark.markedAt).getTime();
        
        // Only consider marks from the last 5 minutes (to avoid showing old marks)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        console.log('[AttentionToast] Checking mark:', { 
          assignedTo: mark.assignedTo, 
          markedAt: new Date(mark.markedAt).toISOString(),
          isRecent: markDate > fiveMinutesAgo 
        });
        
        if (markDate > fiveMinutesAgo) {
          showToastForMark(mark);
        }
      }
    } catch (error) {
      console.error('[AttentionToast] Polling error:', error);
    }
  }, [getUserEmail, showToastForMark]);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    
    console.log('[AttentionToast] ⏰ Starting polling fallback');
    
    // Initial fetch
    fetchNewMarks();
    
    // Poll every 30 seconds as backup
    pollingIntervalRef.current = setInterval(() => {
      if (!isConnectedRef.current) {
        fetchNewMarks();
      }
    }, 30000);
  }, [fetchNewMarks]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[AttentionToast] Stopped polling');
    }
  }, []);

  // Handle incoming SSE event
  const handleSSEEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Skip connection/keep-alive events
      if (data.status === 'connected') {
        console.log('[AttentionToast] SSE connected');
        return;
      }

      // Only show toast if it's for the current user (case-insensitive)
      const currentUserEmail = (userEmailRef.current || getUserEmail() || '').toLowerCase();
      const eventEmail = (data.userEmail || '').toLowerCase();
      
      if (eventEmail !== currentUserEmail) {
        console.log(`[AttentionToast] Skipping - event for ${data.userEmail}, current user is ${currentUserEmail}`);
        return;
      }

      // Check if already seen
      if (isAlreadySeen(data.markId)) {
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
  }, [getUserEmail, isAlreadySeen]);

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
          console.warn('[AttentionToast] SSE connection error, starting polling fallback');
          eventSource.close();
          eventSourceRef.current = null;
          isConnectedRef.current = false;
          
          // Start polling as fallback when SSE fails
          startPolling();

          // Try to reconnect after 5 seconds
          setTimeout(() => {
            if (!isConnectedRef.current) {
              connectSSE();
            }
          }, 5000);
        };

        eventSource.onopen = () => {
          console.log('[AttentionToast] SSE connection opened');
          isConnectedRef.current = true;
          // Stop polling when SSE is connected
          stopPolling();
        };
      } catch (error) {
        console.error('[AttentionToast] Failed to connect SSE:', error);
        // Start polling as fallback
        startPolling();
      }
    };

    connectSSE();

    // Also start polling initially as backup (in case SSE never connects)
    const initialPollingTimeout = setTimeout(() => {
      if (!isConnectedRef.current) {
        startPolling();
      }
    }, 2000);

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        isConnectedRef.current = false;
      }
      stopPolling();
      clearTimeout(initialPollingTimeout);
    };
  }, [getUserEmail, handleSSEEvent, startPolling, stopPolling]);

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