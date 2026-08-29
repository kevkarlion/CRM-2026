'use client';

import { NEXT_ACTION_LABELS, type NextActionType } from '@/quotes/types/client-quote-types';

export function getNextAction(entity: {
  status: string;
  entityType: string;
  validUntil?: string | null;
  hasNegotiationWithCounteroffer?: boolean;
  workOrderStatus?: string | null;
  leadStatus?: string | null;
  saleType?: string | null;
}): { type: NextActionType; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (entity.entityType === 'quote') {
    if (entity.status === 'draft') {
      return { type: 'send_quote', label: NEXT_ACTION_LABELS.send_quote };
    }
    if (entity.status === 'approved') {
      // Step 1: If lead not won yet → confirm sale first
      if (entity.leadStatus !== 'won') {
        return { type: 'confirm_sale', label: NEXT_ACTION_LABELS.confirm_sale };
      }
      // Step 2-4: Lead won — check work order status
      if (entity.workOrderStatus) {
        if (entity.workOrderStatus === 'draft') {
          return { type: 'schedule_work_order', label: NEXT_ACTION_LABELS.schedule_work_order };
        }
        return { type: 'awaiting_execution', label: NEXT_ACTION_LABELS.awaiting_execution };
      }
      // Lead won but no work order → convert to OT
      return { type: 'convert_to_work_order', label: NEXT_ACTION_LABELS.convert_to_work_order };
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
    // Product sale - no work order or explicitly product
    if (!entity.workOrderStatus || entity.saleType === 'product') {
      return { type: 'product_sale', label: NEXT_ACTION_LABELS.product_sale };
    }
    if (entity.workOrderStatus === 'draft') {
      return { type: 'schedule_work_order', label: NEXT_ACTION_LABELS.schedule_work_order };
    }
    return { type: 'awaiting_execution', label: NEXT_ACTION_LABELS.awaiting_execution };
  }

  return { type: 'none', label: NEXT_ACTION_LABELS.none };
}

const actionStyles: Record<NextActionType, string> = {
  send_quote: 'bg-brand-600 text-white',
  follow_up: 'bg-amber-500 text-gray-900',
  go_to_negotiation: 'bg-violet-600 text-white',
  convert_to_work_order: 'bg-emerald-700 text-white',
  contact_client: 'bg-rose-600 text-white',
  review_and_requote: 'bg-red-600 text-white',
  respond_counteroffer: 'bg-violet-600 text-white',
  confirm_sale: 'bg-emerald-700 text-white',
  schedule_work_order: 'bg-sky-600 text-white',
  awaiting_execution: 'bg-gray-700 text-white',
  follow_up_visit: 'bg-teal-600 text-white',
  product_sale: 'bg-gray-800 text-white',
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
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
