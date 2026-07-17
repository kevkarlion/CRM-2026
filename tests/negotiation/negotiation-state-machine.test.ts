import { describe, it, expect } from 'vitest';
import { validateTransition, allowedTransitions, validateBusinessGuards } from '../../src/negotiation/services/negotiation-state-machine';
import type { NegotiationStatus } from '../../src/negotiation/types/negotiation';

const ALL_STATUSES: NegotiationStatus[] = [
  'open', 'counteroffer_made', 'accepted', 'rejected', 'expired',
];

describe('Negotiation State Machine', () => {
  describe('validateTransition allows valid transitions', () => {
    const valid: Array<[NegotiationStatus, NegotiationStatus]> = [
      ['open', 'counteroffer_made'],
      ['open', 'expired'],
      ['counteroffer_made', 'accepted'],
      ['counteroffer_made', 'rejected'],
      ['counteroffer_made', 'expired'],
      ['counteroffer_made', 'counteroffer_made'],
    ];

    for (const [from, to] of valid) {
      it(`allows ${from} → ${to}`, () => {
        expect(validateTransition(from, to)).toBe(true);
      });
    }
  });

  describe('validateTransition rejects invalid transitions', () => {
    const invalid: Array<[NegotiationStatus, NegotiationStatus]> = [
      ['open', 'accepted'],
      ['open', 'rejected'],
      ['open', 'counteroffer_made'],
      ['open', 'open'],
      ['counteroffer_made', 'open'],
      ['accepted', 'open'],
      ['accepted', 'counteroffer_made'],
      ['accepted', 'rejected'],
      ['accepted', 'expired'],
      ['rejected', 'open'],
      ['rejected', 'counteroffer_made'],
      ['rejected', 'accepted'],
      ['rejected', 'expired'],
      ['expired', 'open'],
      ['expired', 'counteroffer_made'],
      ['expired', 'accepted'],
      ['expired', 'rejected'],
    ];

    for (const [from, to] of invalid) {
      it(`rejects ${from} → ${to}`, () => {
        expect(validateTransition(from, to)).toBe(false);
      });
    }
  });

  it('returns false for unknown current status', () => {
    expect(validateTransition('unknown' as NegotiationStatus, 'open')).toBe(false);
  });

  describe('allowedTransitions table consistency', () => {
    it('every status has an entry', () => {
      for (const status of ALL_STATUSES) {
        expect(allowedTransitions[status]).toBeDefined();
        expect(Array.isArray(allowedTransitions[status])).toBe(true);
      }
    });

    it('terminal statuses have no outgoing transitions', () => {
      expect(allowedTransitions.accepted).toHaveLength(0);
      expect(allowedTransitions.rejected).toHaveLength(0);
      expect(allowedTransitions.expired).toHaveLength(0);
    });

    it('counteroffer_made has 4 outgoing transitions including self-loop', () => {
      expect(allowedTransitions.counteroffer_made).toHaveLength(4);
      expect(allowedTransitions.counteroffer_made).toContain('counteroffer_made');
    });
  });

  describe('validateBusinessGuards', () => {
    describe('target: accepted', () => {
      it('returns valid true when at least one counteroffer is accepted', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [{ status: 'accepted' }] } as any,
          'accepted',
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('returns valid false when no counteroffer is accepted', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [{ status: 'pending' }, { status: 'rejected' }] } as any,
          'accepted',
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('accepted');
      });

      it('returns valid false when counterOffers is empty', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [] } as any,
          'accepted',
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    describe('target: rejected', () => {
      it('returns valid true when all counteroffers are terminal and none accepted', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [{ status: 'rejected' }, { status: 'expired' }, { status: 'cancelled' }] } as any,
          'rejected',
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('returns valid false when any counteroffer is still pending', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [{ status: 'pending' }, { status: 'rejected' }] } as any,
          'rejected',
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('terminal');
      });

      it('returns valid false when a counteroffer is accepted', () => {
        const result = validateBusinessGuards(
          { status: 'counteroffer_made', counterOffers: [{ status: 'accepted' }, { status: 'rejected' }] } as any,
          'rejected',
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('accepted');
      });
    });

    describe('target: expired', () => {
      it('returns valid true when negotiation validUntil has passed', () => {
        const result = validateBusinessGuards(
          { status: 'open', counterOffers: [], validUntil: new Date('2020-01-01') } as any,
          'expired',
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('returns valid true when all counteroffer validUntil have passed and none accepted', () => {
        const result = validateBusinessGuards(
          {
            status: 'counteroffer_made',
            validUntil: new Date('2099-12-31'),
            counterOffers: [
              { status: 'pending', validUntil: new Date('2020-01-01') },
              { status: 'pending', validUntil: new Date('2020-06-01') },
            ],
          } as any,
          'expired',
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('returns valid false when validUntil is in the future and counteroffers not all expired', () => {
        const result = validateBusinessGuards(
          {
            status: 'counteroffer_made',
            validUntil: new Date('2099-12-31'),
            counterOffers: [{ status: 'pending', validUntil: new Date('2099-12-31') }],
          } as any,
          'expired',
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      });

      it('returns valid false when a counteroffer is accepted even if all expired', () => {
        const result = validateBusinessGuards(
          {
            status: 'counteroffer_made',
            validUntil: new Date('2099-12-31'),
            counterOffers: [
              { status: 'accepted', validUntil: new Date('2020-01-01') },
              { status: 'pending', validUntil: new Date('2020-01-01') },
            ],
          } as any,
          'expired',
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('non-terminal targets', () => {
      it('returns valid true for open and counteroffer_made (no guards needed)', () => {
        expect(validateBusinessGuards({ status: 'open', counterOffers: [] } as any, 'open').valid).toBe(true);
        expect(validateBusinessGuards({ status: 'open', counterOffers: [] } as any, 'counteroffer_made').valid).toBe(true);
      });
    });
  });
});
