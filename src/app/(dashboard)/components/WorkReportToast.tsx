'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useVisiblePolling } from '@/lib/use-visible-polling';

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
 * WorkReportToast - Notifications for completed work reports
 *
 * Single visibility-aware 15s polling path via useVisiblePolling: polls only
 * while the tab is visible+focused and pauses while hidden/blurred. No SSE and
 * no backup loop — one loop, keyed `notifications:work-reports`. Persists in
 * DB for missed events so polling reconciliation surfaces them.
 */
export function WorkReportToast({ isAdmin = false }: WorkReportToastProps) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Fetch notifications via polling
  const fetchNotifications = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const result = await api.get<{ data: NotificationData[]; unreadCount: number }>('/api/notifications', {
        limit: '20',
        unreadOnly: 'true',
      });

      const notifications = result.data || [];

      // Get IDs we've already shown (both notification._id and workOrderId)
      const shownIds = new Set(toasts.map(t => t.id));
      const shownWorkOrderIds = new Set(toasts.map(t => t.data?.data?.workOrderId));

      // Add new notifications - use workOrderId as id for consistency
      const newToasts = notifications
        .filter(n => {
          const workOrderId = n.data?.workOrderId;
          // Skip if we already have this notification by _id OR by workOrderId
          return !shownIds.has(n._id) && !shownWorkOrderIds.has(workOrderId);
        })
        .map(n => {
          const workOrderId = n.data?.workOrderId || n._id;
          return {
            id: workOrderId,
            data: n,
          };
        });

      if (newToasts.length > 0) {
        setToasts(prev => [...prev, ...newToasts]);
      }
    } catch (error) {
      console.error('[Toast] Polling fetch failed:', error);
    }
  }, [isAdmin, toasts]);

  // Single polling path: 15s while visible, paused while hidden (no SSE).
  // enabled=isAdmin so non-admin mounts contribute nothing to the loop.
  useVisiblePolling({
    key: 'notifications:work-reports',
    interval: 15_000,
    fetcher: fetchNotifications,
    enabled: isAdmin,
  });

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