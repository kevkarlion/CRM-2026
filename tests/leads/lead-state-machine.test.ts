import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  TransitionError,
} from '../../src/leads/helpers/lead-state-machine';

import type { LeadStatus } from '../../src/leads/types/lead';

const ALL_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'technical_visit', 'quote_sent', 'negotiation', 'won', 'lost', 'disqualified',
];

describe('Lead State Machine', () => {
  describe('canTransition', () => {
    it('allows new → contacted', () => {
      expect(canTransition('new', 'contacted')).toBe(true);
    });

    it('allows new → lost', () => {
      expect(canTransition('new', 'lost')).toBe(true);
    });

    it('allows contacted → quote_sent', () => {
      expect(canTransition('contacted', 'quote_sent')).toBe(true);
    });

    it('allows contacted → technical_visit', () => {
      expect(canTransition('contacted', 'technical_visit')).toBe(true);
    });

    it('allows contacted → lost', () => {
      expect(canTransition('contacted', 'lost')).toBe(true);
    });

    it('allows quote_sent → won', () => {
      expect(canTransition('quote_sent', 'won')).toBe(true);
    });

    it('allows negotiation → won', () => {
      expect(canTransition('negotiation', 'won')).toBe(true);
    });

    it('allows quote_sent → lost', () => {
      expect(canTransition('quote_sent', 'lost')).toBe(true);
    });

    it('allows negotiation → lost', () => {
      expect(canTransition('negotiation', 'lost')).toBe(true);
    });

    it('blocks new → quote_sent (skips contacted)', () => {
      expect(canTransition('new', 'quote_sent')).toBe(false);
    });

    it('blocks new → won (skips contacted + qualified)', () => {
      expect(canTransition('new', 'won')).toBe(false);
    });

    it('blocks won → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'won') continue;
        expect(canTransition('won', target)).toBe(false);
      }
    });

    it('blocks lost → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'lost') continue;
        expect(canTransition('lost', target)).toBe(false);
      }
    });

    it('blocks disqualified → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'disqualified') continue;
        expect(canTransition('disqualified', target)).toBe(false);
      }
    });
  });

  describe('validateTransition', () => {
    it('passes valid transitions without throwing', () => {
      expect(() => validateTransition('new', 'contacted')).not.toThrow();
      expect(() => validateTransition('new', 'lost')).not.toThrow();
      expect(() => validateTransition('contacted', 'quote_sent')).not.toThrow();
      expect(() => validateTransition('contacted', 'technical_visit')).not.toThrow();
      expect(() => validateTransition('contacted', 'lost')).not.toThrow();
      expect(() => validateTransition('quote_sent', 'won')).not.toThrow();
      expect(() => validateTransition('negotiation', 'won')).not.toThrow();
      expect(() => validateTransition('quote_sent', 'lost')).not.toThrow();
      expect(() => validateTransition('negotiation', 'lost')).not.toThrow();
    });

    it('throws TransitionError on invalid transition', () => {
      expect(() => validateTransition('new', 'quote_sent')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal won', () => {
      expect(() => validateTransition('won', 'contacted')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal lost', () => {
      expect(() => validateTransition('lost', 'quote_sent')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal disqualified', () => {
      expect(() => validateTransition('disqualified', 'new')).toThrow(TransitionError);
    });

    describe('guards with context', () => {
      it('new → contacted requires hasActivity', () => {
        expect(() => validateTransition('new', 'contacted', { hasActivity: true })).not.toThrow();
        expect(() => validateTransition('new', 'contacted', { hasActivity: false })).toThrow(TransitionError);
      });

      it('contacted → quote_sent requires hasRequiredFields', () => {
        expect(() => validateTransition('contacted', 'quote_sent', { hasRequiredFields: true })).not.toThrow();
        expect(() => validateTransition('contacted', 'quote_sent', { hasRequiredFields: false })).toThrow(TransitionError);
      });

      it('contacted → technical_visit requires hasRequiredFields', () => {
        expect(() => validateTransition('contacted', 'technical_visit', { hasRequiredFields: true })).not.toThrow();
        expect(() => validateTransition('contacted', 'technical_visit', { hasRequiredFields: false })).toThrow(TransitionError);
      });

      it('quote_sent → won requires hasClient', () => {
        expect(() => validateTransition('quote_sent', 'won', { hasClient: true })).not.toThrow();
        expect(() => validateTransition('quote_sent', 'won', { hasClient: false })).toThrow(TransitionError);
      });

      it('negotiation → won requires hasClient', () => {
        expect(() => validateTransition('negotiation', 'won', { hasClient: true })).not.toThrow();
        expect(() => validateTransition('negotiation', 'won', { hasClient: false })).toThrow(TransitionError);
      });

      it('throws specific guard message for missing activity', () => {
        try {
          validateTransition('new', 'contacted', { hasActivity: false });
        } catch (e) {
          expect((e as TransitionError).message).toContain('Requires at least one activity record');
        }
      });

      it('throws specific guard message for missing required fields', () => {
        try {
          validateTransition('contacted', 'quote_sent', { hasRequiredFields: false });
        } catch (e) {
          expect((e as TransitionError).message).toContain('Requires complete minimum information');
        }
      });

      it('throws specific guard message for missing client conversion', () => {
        try {
          validateTransition('quote_sent', 'won', { hasClient: false });
        } catch (e) {
          expect((e as TransitionError).message).toContain('Cannot mark as won without converting to Client first');
        }
      });
    });
  });

  describe('canTransition returns boolean', () => {
    it('returns true for valid pair', () => {
      expect(canTransition('new', 'contacted')).toBe(true);
    });

    it('returns false for invalid pair', () => {
      expect(canTransition('won', 'new')).toBe(false);
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
      expect(VALID_TRANSITIONS.won).toHaveLength(0);
      expect(VALID_TRANSITIONS.lost).toHaveLength(0);
      expect(VALID_TRANSITIONS.disqualified).toHaveLength(0);
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('contains won, lost, disqualified', () => {
      expect(TERMINAL_STATUSES).toContain('won');
      expect(TERMINAL_STATUSES).toContain('lost');
      expect(TERMINAL_STATUSES).toContain('disqualified');
    });

    it('does not contain non-terminal statuses', () => {
      expect(TERMINAL_STATUSES).not.toContain('new');
      expect(TERMINAL_STATUSES).not.toContain('contacted');
      expect(TERMINAL_STATUSES).not.toContain('negotiation');
    });
  });
});
