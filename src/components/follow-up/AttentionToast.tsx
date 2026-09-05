'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useVisiblePolling } from '@/lib/use-visible-polling';

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
 * Single visibility-aware 15s polling path via useVisiblePolling: polls only
 * while the tab is visible+focused and pauses while hidden/blurred. No SSE.
 *
 * Poll key `follow-up-marks:all` is shared with other global follow-up-marks
 * consumers (e.g. pipeline badges) — keyed dedup collapses concurrent mounts
 * into one poll loop, so a globally-mounted toast across pages cannot spawn
 * duplicate loops.
 *
 * ONLY Rolija (ro.lija@hotmail.com) should see these toasts.
 */
export function AttentionToast({ className = '' }: AttentionToastProps) {
  const router = useRouter();

  // EARLY RETURN: Only Rolija sees toasts
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

  const currentUserEmail = getUserEmail();
  const isRolija = currentUserEmail?.toLowerCase() === 'ro.lija@hotmail.com';

  // If not Rolija, don't render anything
  if (!isRolija) {
    return null;
  }

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const userEmailRef = useRef<string | null>(currentUserEmail);

  // Get tenant ID from localStorage
  const getTenantId = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tenantId');
  }, []);

  // Show toast for a mark (API already filters by timestamp, so just check user match)
  const showToastForMark = useCallback(
    (mark: FollowUpMarkResponse) => {
      const currentUserEmail = (userEmailRef.current || getUserEmail() || '').toLowerCase();
      const markAssignedTo = (mark.assignedTo || '').toLowerCase();

      // Only show if it's for current user (case-insensitive)
      if (markAssignedTo !== currentUserEmail) return;

      // Extract target info - use the 'target' field which is populated
      let targetId = '';
      let targetName = 'Elemento sin nombre';
      let targetType: 'lead' | 'client' = 'lead';

      if ((mark as any).target) {
        const target = (mark as any).target;
        targetId = target._id;
        targetName = target.profileName || target.name || 'Lead sin nombre';
        targetType = (mark as any).targetType === 'client' ? 'client' : 'lead';
      } else if (mark.leadId) {
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

      setToasts((prev) =>
        prev.some((t) => t._id === mark._id) ? prev : [...prev, toastItem],
      );
    },
    [getUserEmail],
  );

  // Polling fetch - get NEW marks since last check (using timestamp)
  const fetchNewMarks = useCallback(async () => {
    const userEmail = getUserEmail();
    if (!userEmail) return;

    try {
      const tenantId = getTenantId();
      const headers: Record<string, string> = {};
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }

      // Get last check timestamp from localStorage
      const lastCheckKey = `atencion_last_check_${userEmail}`;
      const lastCheck = localStorage.getItem(lastCheckKey);

      // Build URL with 'since' parameter if we have a last check timestamp
      let url = '/api/follow-up-marks?userAll=true';
      if (lastCheck) {
        url += `&since=${encodeURIComponent(lastCheck)}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) return;

      const marks: FollowUpMarkResponse[] = await response.json();
      if (!Array.isArray(marks)) return;

      // Check each mark and show toast if for current user
      // Since API already filters by timestamp, all marks are "new"
      for (const mark of marks) {
        showToastForMark(mark);
      }

      // Update last check timestamp AFTER successful fetch
      localStorage.setItem(lastCheckKey, new Date().toISOString());
    } catch {
      // Silent fail
    }
  }, [getUserEmail, getTenantId, showToastForMark]);

  // Single polling path: 15s while visible, paused while hidden (no SSE).
  useVisiblePolling({
    key: 'follow-up-marks:all',
    interval: 15_000,
    fetcher: fetchNewMarks,
  });

  const handleToastClick = useCallback((toast: ToastItem) => {
    // No need to mark as seen - timestamps handle that
    if (toast.type === 'lead') {
      router.push(`/leads/${toast.id}`);
    } else {
      router.push(`/clients/${toast.id}`);
    }
    setToasts((prev) => prev.filter((t) => t._id !== toast._id));
  }, [router]);

  const handleDismiss = useCallback((toast: ToastItem, e: React.MouseEvent) => {
    // No need to mark as seen - timestamps handle that
    e.stopPropagation();
    setToasts((prev) => prev.filter((t) => t._id !== toast._id));
  }, []);

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