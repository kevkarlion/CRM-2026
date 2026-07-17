'use client';

import type { ExpiryBadgeResult } from '@/quotes/types/client-quote-types';

export function getExpiryBadge(entity: {
  status: string;
  validUntil?: string | null;
  entityType?: string;
}): ExpiryBadgeResult {
  const approvedStatuses = ['approved', 'accepted'];
  if (approvedStatuses.includes(entity.status)) {
    return { type: 'none', label: '', colorClass: '' };
  }

  if (!entity.validUntil) {
    return { type: 'none', label: '', colorClass: '' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validDate = new Date(entity.validUntil);
  const validDay = new Date(validDate.getUTCFullYear(), validDate.getUTCMonth(), validDate.getUTCDate());
  const diffTime = validDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      type: 'expired',
      label: 'Vencida',
      colorClass: 'text-red-600 bg-red-50 ring-red-600/20',
    };
  }

  if (diffDays <= 7) {
    return {
      type: 'expiring',
      label: diffDays === 0 ? 'Por vencer hoy' : `Por vencer en ${diffDays} día${diffDays === 1 ? '' : 's'}`,
      colorClass: 'text-orange-600 bg-orange-50 ring-orange-600/20',
    };
  }

  return { type: 'none', label: '', colorClass: '' };
}

interface ExpiryBadgeProps {
  entity: { status: string; validUntil?: string | null; entityType?: string };
}

export function ExpiryBadge({ entity }: ExpiryBadgeProps) {
  const badge = getExpiryBadge(entity);
  if (badge.type === 'none') return null;

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badge.colorClass}`}>
      {badge.label}
    </span>
  );
}
