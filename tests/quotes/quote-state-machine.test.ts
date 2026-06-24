import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  TransitionError,
  validateSendRequirements,
  validateApproveRequirements,
} from '../../src/quotes/helpers/state-machine';

import type { QuoteStatus } from '../../src/quotes/types/quote';

const ALL_STATUSES: QuoteStatus[] = [
  'draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled',
];

describe('Quote State Machine', () => {
  describe('canTransition', () => {
    it('allows draft → sent', () => {
      expect(canTransition('draft', 'sent')).toBe(true);
    });

    it('allows draft → cancelled', () => {
      expect(canTransition('draft', 'cancelled')).toBe(true);
    });

    it('allows sent → approved', () => {
      expect(canTransition('sent', 'approved')).toBe(true);
    });

    it('allows sent → rejected', () => {
      expect(canTransition('sent', 'rejected')).toBe(true);
    });

    it('allows sent → expired', () => {
      expect(canTransition('sent', 'expired')).toBe(true);
    });

    it('allows sent → cancelled', () => {
      expect(canTransition('sent', 'cancelled')).toBe(true);
    });

    it('blocks draft → approved', () => {
      expect(canTransition('draft', 'approved')).toBe(false);
    });

    it('blocks sent → draft', () => {
      expect(canTransition('sent', 'draft')).toBe(false);
    });

    it('blocks approved → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'approved') continue;
        expect(canTransition('approved', target)).toBe(false);
      }
    });

    it('blocks rejected → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'rejected') continue;
        expect(canTransition('rejected', target)).toBe(false);
      }
    });

    it('blocks expired → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'expired') continue;
        expect(canTransition('expired', target)).toBe(false);
      }
    });

    it('blocks cancelled → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'cancelled') continue;
        expect(canTransition('cancelled', target)).toBe(false);
      }
    });
  });

  describe('validateTransition', () => {
    it('passes valid transitions without throwing', () => {
      expect(() => validateTransition('draft', 'sent')).not.toThrow();
      expect(() => validateTransition('draft', 'cancelled')).not.toThrow();
      expect(() => validateTransition('sent', 'approved')).not.toThrow();
      expect(() => validateTransition('sent', 'rejected')).not.toThrow();
      expect(() => validateTransition('sent', 'expired')).not.toThrow();
      expect(() => validateTransition('sent', 'cancelled')).not.toThrow();
    });

    it('throws TransitionError on invalid (draft → approved)', () => {
      expect(() => validateTransition('draft', 'approved')).toThrow(TransitionError);
    });

    it('throws TransitionError on invalid (sent → draft)', () => {
      expect(() => validateTransition('sent', 'draft')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal approved', () => {
      expect(() => validateTransition('approved', 'draft')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal rejected', () => {
      expect(() => validateTransition('rejected', 'sent')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal expired', () => {
      expect(() => validateTransition('expired', 'sent')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal cancelled', () => {
      expect(() => validateTransition('cancelled', 'draft')).toThrow(TransitionError);
    });

    it('throws TransitionError on self-transition (draft → draft)', () => {
      expect(() => validateTransition('draft', 'draft')).toThrow(TransitionError);
    });
  });

  describe('canTransition returns boolean', () => {
    it('returns true for valid pair', () => {
      expect(canTransition('draft', 'sent')).toBe(true);
    });

    it('returns false for invalid pair', () => {
      expect(canTransition('approved', 'draft')).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS table consistency', () => {
    it('every status has an entry', () => {
      for (const status of ALL_STATUSES) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('terminal statuses have no outgoing transitions', () => {
      expect(VALID_TRANSITIONS.approved).toHaveLength(0);
      expect(VALID_TRANSITIONS.rejected).toHaveLength(0);
      expect(VALID_TRANSITIONS.expired).toHaveLength(0);
      expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('contains approved, rejected, expired, cancelled', () => {
      expect(TERMINAL_STATUSES).toContain('approved');
      expect(TERMINAL_STATUSES).toContain('rejected');
      expect(TERMINAL_STATUSES).toContain('expired');
      expect(TERMINAL_STATUSES).toContain('cancelled');
    });

    it('does not contain non-terminal statuses', () => {
      expect(TERMINAL_STATUSES).not.toContain('draft');
      expect(TERMINAL_STATUSES).not.toContain('sent');
    });
  });

  describe('validateSendRequirements', () => {
    it('rejects missing items', () => {
      expect(() =>
        validateSendRequirements({ items: [], clientId: 'c1', validUntil: null }),
      ).toThrow(TransitionError);
    });

    it('rejects missing clientId', () => {
      expect(() =>
        validateSendRequirements({ items: [{ desc: 'test' }], clientId: '', validUntil: null }),
      ).toThrow(TransitionError);
    });

    it('rejects expired validUntil', () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(() =>
        validateSendRequirements({ items: [{ desc: 'test' }], clientId: 'c1', validUntil: yesterday }),
      ).toThrow(TransitionError);
    });

    it('passes when all requirements met (future validUntil)', () => {
      const future = new Date(Date.now() + 86400000);
      expect(() =>
        validateSendRequirements({ items: [{ desc: 'test' }], clientId: 'c1', validUntil: future }),
      ).not.toThrow();
    });

    it('passes when all requirements met (null validUntil)', () => {
      expect(() =>
        validateSendRequirements({ items: [{ desc: 'test' }], clientId: 'c1', validUntil: null }),
      ).not.toThrow();
    });
  });

  describe('validateApproveRequirements', () => {
    it('rejects expired validUntil', () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(() => validateApproveRequirements({ validUntil: yesterday })).toThrow(TransitionError);
    });

    it('passes when validUntil is null', () => {
      expect(() => validateApproveRequirements({ validUntil: null })).not.toThrow();
    });

    it('passes when validUntil is in future', () => {
      const future = new Date(Date.now() + 86400000);
      expect(() => validateApproveRequirements({ validUntil: future })).not.toThrow();
    });
  });
});
