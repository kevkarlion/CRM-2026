import { describe, it, expect } from 'vitest';
import { validateTransition, validateBusinessGuards } from './negotiation-state-machine';

describe('validateTransition', () => {
  it('allows open → counteroffer_made', () => {
    expect(validateTransition('open', 'counteroffer_made')).toBe(true);
  });

  it('allows counteroffer_made → counteroffer_made', () => {
    expect(validateTransition('counteroffer_made', 'counteroffer_made')).toBe(true);
  });

  it('allows counteroffer_made → accepted', () => {
    expect(validateTransition('counteroffer_made', 'accepted')).toBe(true);
  });

  it('allows counteroffer_made → rejected', () => {
    expect(validateTransition('counteroffer_made', 'rejected')).toBe(true);
  });

  it('allows counteroffer_made → expired', () => {
    expect(validateTransition('counteroffer_made', 'expired')).toBe(true);
  });

  it('rejects open → accepted', () => {
    expect(validateTransition('open', 'accepted')).toBe(false);
  });

  it('rejects accepted → open', () => {
    expect(validateTransition('accepted', 'open')).toBe(false);
  });
});

describe('validateBusinessGuards', () => {
  const mockNegotiation = {
    counterOffers: [
      { status: 'pending' },
      { status: 'accepted' },
    ],
    validUntil: new Date('2099-12-31'),
  };

  it('allows accepted when at least one counteroffer is accepted', () => {
    const result = validateBusinessGuards(mockNegotiation, 'accepted');
    expect(result.valid).toBe(true);
  });

  it('rejects accepted when no counteroffer is accepted', () => {
    const neg = { ...mockNegotiation, counterOffers: [{ status: 'pending' }] };
    const result = validateBusinessGuards(neg, 'accepted');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('accepted');
  });

  it('allows rejected when all counteroffers are terminal and none accepted', () => {
    const neg = {
      ...mockNegotiation,
      counterOffers: [{ status: 'rejected' }, { status: 'expired' }],
    };
    const result = validateBusinessGuards(neg, 'rejected');
    expect(result.valid).toBe(true);
  });

  it('rejects rejected when some counteroffer is still pending', () => {
    const neg = {
      ...mockNegotiation,
      counterOffers: [{ status: 'pending' }, { status: 'rejected' }],
    };
    const result = validateBusinessGuards(neg, 'rejected');
    expect(result.valid).toBe(false);
  });

  it('allows expired when validUntil has passed', () => {
    const neg = {
      ...mockNegotiation,
      validUntil: new Date('2020-01-01'),
      counterOffers: [],
    };
    const result = validateBusinessGuards(neg, 'expired');
    expect(result.valid).toBe(true);
  });
});
