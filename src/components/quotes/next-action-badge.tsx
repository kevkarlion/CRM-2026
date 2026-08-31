'use client';

import { NEXT_ACTION_LABELS, type NextActionType } from '@/quotes/types/client-quote-types';

export function mapWorkOrderStatusToAction(status: string): NextActionType {
  if (status === 'draft') return 'schedule_work_order';
  if (status === 'closed' || status === 'completed') return 'work_order_closed';
  if (status === 'cancelled') return 'work_order_cancelled';
  return 'awaiting_execution';
}

export function getNextAction(entity: {
  status: string;
  entityType: string;
  validUntil?: string | null;
  hasNegotiationWithCounteroffer?: boolean;
  workOrderStatus?: string | null;
  leadStatus?: string | null;
  saleType?: string | null;
  leadHasWorkOrder?: boolean;
  leadWorkOrderStatus?: string | null;
}): { type: NextActionType; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (entity.entityType === 'quote') {
    if (entity.status === 'draft') {
      return { type: 'send_quote', label: NEXT_ACTION_LABELS.send_quote };
    }
    if (entity.status === 'approved') {
      // Step 1: Lead not won yet → confirm sale first
      if (entity.leadStatus !== 'won') {
        return { type: 'confirm_sale', label: NEXT_ACTION_LABELS.confirm_sale };
      }
      // Step 2: Lead won — own work order wins (D5)
      if (entity.workOrderStatus) {
        const type = mapWorkOrderStatusToAction(entity.workOrderStatus);
        return { type, label: NEXT_ACTION_LABELS[type] };
      }
      // Step 3: Lead won, no own WO → map sibling lead WO (D2)
      if (entity.leadHasWorkOrder && entity.leadWorkOrderStatus) {
        const type = mapWorkOrderStatusToAction(entity.leadWorkOrderStatus);
        return { type, label: NEXT_ACTION_LABELS[type] };
      }
      // Step 4: Lead won, no WO anywhere → read-only degenerate (F1)
      return { type: 'none', label: NEXT_ACTION_LABELS.none };
    }
    if (entity.status === 'expired') {
      return { type: 'review_and_requote', label: NEXT_ACTION_LABELS.review_and_requote };
    }
    if (entity.status === 'sent') {
      if (entity.validUntil) {
        const validDate = new Date(entity.validUntil);
        const diffTime = validDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          return { type: 'contact_client', label: NEXT_ACTION_LABELS.contact_client };
        }
      }
      if (entity.hasNegotiationWithCounteroffer) {
        return { type: 'go_to_negotiation', label: NEXT_ACTION_LABELS.go_to_negotiation };
      }
      return { type: 'follow_up', label: NEXT_ACTION_LABELS.follow_up };
    }
  }

  if (entity.entityType === 'negotiation') {
    if (entity.status === 'counteroffer_made') {
      return { type: 'respond_counteroffer', label: NEXT_ACTION_LABELS.respond_counteroffer };
    }
  }

  if (entity.entityType === 'technical_visit') {
    return { type: 'follow_up_visit', label: NEXT_ACTION_LABELS.follow_up_visit };
  }

  if (entity.entityType === 'quote' && entity.status === 'direct_sale') {
    // Own work order present → WO status wins, including product rows (D3)
    if (entity.workOrderStatus) {
      const type = mapWorkOrderStatusToAction(entity.workOrderStatus);
      return { type, label: NEXT_ACTION_LABELS[type] };
    }
    // No work order (or explicitly product) → product sale
    return { type: 'product_sale', label: NEXT_ACTION_LABELS.product_sale };
  }

  return { type: 'none', label: NEXT_ACTION_LABELS.none };
}

const actionStyles: Record<NextActionType, string> = {
  send_quote:
    'bg-brand-500/10 text-brand-700 ring-1 ring-inset ring-brand-600/20 dark:text-brand-300 dark:ring-brand-400/20',
  follow_up:
    'bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/20',
  go_to_negotiation:
    'bg-violet-500/10 text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:text-violet-300 dark:ring-violet-400/20',
  contact_client:
    'bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/20',
  review_and_requote:
    'bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-600/20 dark:text-red-300 dark:ring-red-400/20',
  respond_counteroffer:
    'bg-violet-500/10 text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:text-violet-300 dark:ring-violet-400/20',
  confirm_sale:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/20',
  schedule_work_order:
    'bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/20',
  awaiting_execution:
    'bg-gray-500/10 text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:text-gray-300 dark:ring-gray-400/20',
  work_order_closed:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/20',
  work_order_cancelled:
    'bg-gray-500/10 text-gray-500 ring-1 ring-inset ring-gray-400/20 dark:text-gray-400 dark:ring-gray-500/20',
  follow_up_visit:
    'bg-teal-500/10 text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:text-teal-300 dark:ring-teal-400/20',
  product_sale:
    'bg-indigo-500/10 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:text-indigo-300 dark:ring-indigo-400/20',
  none: '',
};

interface NextActionBadgeProps {
  type: NextActionType;
  label: string;
}

export function NextActionBadge({ type, label }: NextActionBadgeProps) {
  if (type === 'none' || !label) {
    return <span className="text-gray-400">-</span>;
  }

  const style = actionStyles[type] || 'bg-gray-700 text-white';
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
