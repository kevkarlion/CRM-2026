'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'work-report-last-viewed';

interface RecentReport {
  workOrderId: string;
  workOrderNumber: string;
  workReportId: string;
  clientId?: string;
  title?: string;
  closedAt: string;
  technicianName: string;
  technicianId: string;
}

function getLastViewedTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

function setLastViewedTimestamp(timestamp: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, timestamp.toString());
}

interface ToastNotification {
  id: string;
  report: RecentReport;
}

interface WorkReportToastProps {
  isAdmin?: boolean;
}

/**
 * WorkReportToast - Real-time toast notifications for completed work reports
 * 
 * Uses SSE (Server-Sent Events) via EventSource for real-time updates.
 * No polling, no intervals - events are pushed instantly when a technician
 * completes a work report.
 */
export function WorkReportToast({ isAdmin = false }: WorkReportToastProps) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectedRef = useRef(false);

  // Convert SSE event data to RecentReport format
  const convertToRecentReport = (data: {
    workOrderId: string;
    workReportId: string;
    workOrderNumber: string;
    technicianName: string;
    clientId?: string;
    title?: string;
  }): RecentReport => ({
    workOrderId: data.workOrderId,
    workOrderNumber: data.workOrderNumber,
    workReportId: data.workReportId,
    clientId: data.clientId,
    title: data.title,
    closedAt: new Date().toISOString(),
    technicianName: data.technicianName,
    technicianId: '', // Not needed for display
  });

  // Handle incoming SSE event
  const handleSSEEvent = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Skip connection/keep-alive events
      if (data.status === 'connected') {
        console.log('[WorkReportToast] SSE connected');
        return;
      }

      const report = convertToRecentReport(data);
      
      // Add to toasts
      setToasts((prev) => [
        ...prev,
        {
          id: report.workReportId,
          report,
        },
      ]);

      // Update timestamp
      const now = Date.now();
      setLastViewedTimestamp(now);
    } catch (error) {
      console.error('[WorkReportToast] Failed to parse SSE event:', error);
    }
  };

  // Set up SSE connection on mount
  useEffect(() => {
    if (!isAdmin || isConnectedRef.current) return;

    // Prevent double connection in React StrictMode
    if (typeof window === 'undefined') return;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource('/api/sse/work-reports');
        eventSourceRef.current = eventSource;

        // Listen for custom workReportCompleted event
        eventSource.addEventListener('workReportCompleted', handleSSEEvent as EventListener);

        // Also handle default message events (fallback)
        eventSource.onmessage = handleSSEEvent;

        eventSource.onerror = (error) => {
          console.error('[WorkReportToast] SSE connection error:', error);
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
          console.log('[WorkReportToast] SSE connection opened');
          isConnectedRef.current = true;
        };
      } catch (error) {
        console.error('[WorkReportToast] Failed to connect SSE:', error);
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
  }, [isAdmin]);

  const handleToastClick = (report: RecentReport) => {
    // Update timestamp when user clicks to view
    const reportTime = new Date(report.closedAt).getTime();
    setLastViewedTimestamp(reportTime);
    router.push(`/work-orders/informes?workOrderId=${report.workOrderId}`);
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const toast = toasts.find(t => t.id === id);
    if (toast) {
      const reportTime = new Date(toast.report.closedAt).getTime();
      setLastViewedTimestamp(reportTime);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!isAdmin || toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast.report)}
          className="group bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-200 animate-in slide-in-from-right fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-gray-900">
                Orden de Trabajo terminada
              </p>
              {toast.report.title && (
                <p className="text-xs text-gray-600 truncate">{toast.report.title}</p>
              )}
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Ver informe técnico
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <p className="text-xs text-gray-500">
                Técnico: <span className="font-medium text-gray-700">{toast.report.technicianName}</span>
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
