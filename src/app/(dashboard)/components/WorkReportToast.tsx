'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, Bell, BellOff } from 'lucide-react';
import { api } from '@/lib/api-client';

const STORAGE_KEY = 'work-report-last-viewed';

interface NotificationData {
  _id: string;
  type: string;
  title: string;
  message: string;
  data?: {
    workOrderId: string;
    workReportId: string;
    workOrderNumber: string;
    technicianName: string;
  };
  readAt?: string;
  createdAt: string;
}

interface ToastNotification {
  id: string;
  data: NotificationData;
}

interface WorkReportToastProps {
  isAdmin?: boolean;
}

/**
 * WorkReportToast - Robust notifications for completed work reports
 * 
 * Features:
 * - SSE for real-time updates (primary)
 * - Polling fallback every 30s (backup)
 * - Visual connection indicator
 * - Persists in DB for missed events
 */
export function WorkReportToast({ isAdmin = false }: WorkReportToastProps) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<string>('');

  // Fetch notifications via polling
  const fetchNotifications = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      const result = await api.get<{ data: NotificationData[]; unreadCount: number }>('/api/notifications', {
        limit: '20',
        unreadOnly: 'true',
      });
      
      const notifications = result.data || [];
      
      // Get IDs we've already shown
      const shownIds = new Set(toasts.map(t => t.id));
      
      // Add new notifications
      const newToasts = notifications
        .filter(n => !shownIds.has(n._id))
        .map(n => ({
          id: n._id,
          data: n,
        }));
      
      if (newToasts.length > 0) {
        setToasts(prev => [...prev, ...newToasts]);
      }
      
      setConnectionStatus('connected');
    } catch (error) {
      console.error('[WorkReportToast] Polling fetch failed:', error);
      setConnectionStatus('disconnected');
    }
  }, [isAdmin, toasts]);

  // Handle SSE event
  const handleSSEEvent = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Skip connection/keep-alive events
      if (data.status === 'connected') {
        setConnectionStatus('connected');
        return;
      }
      
      // Add new notification from SSE
      setToasts(prev => [...prev, {
        id: data.workReportId || `sse-${Date.now()}`,
        data: {
          _id: data.workReportId,
          type: 'work_report_completed',
          title: 'Orden de Trabajo terminada',
          message: `${data.technicianName} completó ${data.workOrderNumber}`,
          data: {
            workOrderId: data.workOrderId,
            workReportId: data.workReportId,
            workOrderNumber: data.workOrderNumber,
            technicianName: data.technicianName,
          },
          createdAt: new Date().toISOString(),
        },
      }]);
      
      setConnectionStatus('connected');
    } catch (error) {
      console.error('[WorkReportToast] Failed to parse SSE event:', error);
    }
  };

  // Set up SSE connection
  useEffect(() => {
    if (!isAdmin) return;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      
      try {
        const eventSource = new EventSource('/api/sse/work-reports');
        eventSourceRef.current = eventSource;

        eventSource.addEventListener('workReportCompleted', handleSSEEvent as EventListener);
        eventSource.onmessage = handleSSEEvent;

        eventSource.onerror = () => {
          console.log('[WorkReportToast] SSE disconnected, using polling fallback');
          eventSource.close();
          eventSourceRef.current = null;
          isConnectedRef.current = false;
          setConnectionStatus('disconnected');
        };

        eventSource.onopen = () => {
          isConnectedRef.current = true;
          setConnectionStatus('connected');
        };
      } catch (error) {
        console.error('[WorkReportToast] SSE connection failed:', error);
        setConnectionStatus('disconnected');
      }
    };

    connectSSE();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAdmin]);

  // Set up polling fallback
  useEffect(() => {
    if (!isAdmin) return;

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds as fallback
    pollingIntervalRef.current = setInterval(() => {
      if (!isConnectedRef.current) {
        console.log('[WorkReportToast] Using polling fallback');
        fetchNotifications();
      }
    }, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isAdmin, fetchNotifications]);

  // Mark as read when clicking
  const handleToastClick = async (toast: ToastNotification) => {
    try {
      await api.patch('/api/notifications', {
        notificationIds: [toast.id],
      });
    } catch (error) {
      console.error('[WorkReportToast] Failed to mark as read:', error);
    }
    
    router.push(`/work-orders/informes?workOrderId=${toast.data.data?.workOrderId}`);
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await api.patch('/api/notifications', {
        notificationIds: [id],
      });
    } catch (error) {
      console.error('[WorkReportToast] Failed to dismiss:', error);
    }
    
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (!isAdmin || toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          className="group bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-200 animate-in slide-in-from-right fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-gray-900">
                {toast.data.title}
              </p>
              <p className="text-xs text-gray-600 truncate">{toast.data.message}</p>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Ver informe técnico
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <p className="text-xs text-gray-500">
                Técnico: <span className="font-medium text-gray-700">{toast.data.data?.technicianName}</span>
              </p>
            </div>
            <button
              onClick={(e) => handleDismiss(toast.id, e)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Cerrar"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
