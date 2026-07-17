import { NegotiationStatus } from '../types/negotiation';

export const allowedTransitions: Record<NegotiationStatus, NegotiationStatus[]> = {
  open: ['counteroffer_made', 'expired'],
  counteroffer_made: ['accepted', 'rejected', 'expired', 'counteroffer_made'],
  accepted: [],
  rejected: [],
  expired: [],
};

export function validateTransition(
  currentStatus: NegotiationStatus,
  newStatus: NegotiationStatus,
): boolean {
  const validNext = allowedTransitions[currentStatus];
  if (!validNext) return false;
  return validNext.includes(newStatus);
}

const TERMINAL_COUNTEROFFER_STATUSES = ['rejected', 'expired', 'cancelled'] as const;

interface BusinessGuardResult {
  valid: boolean;
  reason?: string;
}

export function validateBusinessGuards(
  negotiation: { status: string; counterOffers: Array<{ status: string; validUntil?: Date }>; validUntil?: Date },
  targetStatus: string,
): BusinessGuardResult {
  if (targetStatus === 'open' || targetStatus === 'counteroffer_made') {
    return { valid: true };
  }

  if (targetStatus === 'accepted') {
    const hasAccepted = negotiation.counterOffers.some(co => co.status === 'accepted');
    if (!hasAccepted) {
      return { valid: false, reason: 'At least one counteroffer must be accepted' };
    }
    return { valid: true };
  }

  if (targetStatus === 'rejected') {
    const hasAccepted = negotiation.counterOffers.some(co => co.status === 'accepted');
    if (hasAccepted) {
      return { valid: false, reason: 'A counteroffer is accepted — cannot reject' };
    }
    const allTerminal = negotiation.counterOffers.length > 0
      && negotiation.counterOffers.every(co => (TERMINAL_COUNTEROFFER_STATUSES as readonly string[]).includes(co.status));
    if (!allTerminal) {
      return { valid: false, reason: 'All counteroffers must be in terminal status (rejected, expired, or cancelled)' };
    }
    return { valid: true };
  }

  if (targetStatus === 'expired') {
    const now = new Date();
    const negotiationExpired = negotiation.validUntil && negotiation.validUntil < now;
    const allCounterOffersExpired = negotiation.counterOffers.length > 0
      && negotiation.counterOffers.every(co => co.validUntil && co.validUntil < now);
    const hasAccepted = negotiation.counterOffers.some(co => co.status === 'accepted');

    if (hasAccepted) {
      return { valid: false, reason: 'A counteroffer is accepted — cannot expire' };
    }

    if (negotiationExpired || allCounterOffersExpired) {
      return { valid: true };
    }

    return { valid: false, reason: 'Neither negotiation nor all counteroffers have expired' };
  }

  return { valid: false, reason: `Unknown target status: ${targetStatus}` };
}
