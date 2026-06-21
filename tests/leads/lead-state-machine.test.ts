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
  'new', 'contacted', 'qualified', 'won', 'lost', 'disqualified',
];

describe('Lead State Machine', () => {
  describe('canTransition', () => {
    it('allows new → contacted', () => {
      expect(canTransition('new', 'contacted')).toBe(true);
    });

    it('allows new → lost', () => {
      expect(canTransition('new', 'lost')).toBe(true);
    });

    it('allows contacted → qualified', () => {
      expect(canTransition('contacted', 'qualified')).toBe(true);
    });

    it('allows contacted → lost', () => {
      expect(canTransition('contacted', 'lost')).toBe(true);
    });

    it('allows qualified → won', () => {
      expect(canTransition('qualified', 'won')).toBe(true);
    });

    it('allows qualified → lost', () => {
      expect(canTransition('qualified', 'lost')).toBe(true);
    });

    it('blocks new → qualified (skips contacted)', () => {
      expect(canTransition('new', 'qualified')).toBe(false);
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
      expect(() => validateTransition('contacted', 'qualified')).not.toThrow();
      expect(() => validateTransition('contacted', 'lost')).not.toThrow();
      expect(() => validateTransition('qualified', 'won')).not.toThrow();
      expect(() => validateTransition('qualified', 'lost')).not.toThrow();
    });

    it('throws TransitionError on invalid transition', () => {
      expect(() => validateTransition('new', 'qualified')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal won', () => {
      expect(() => validateTransition('won', 'contacted')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal lost', () => {
      expect(() => validateTransition('lost', 'qualified')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal disqualified', () => {
      expect(() => validateTransition('disqualified', 'new')).toThrow(TransitionError);
    });

    describe('guards with context', () => {
      it('new → contacted requires hasActivity', () => {
        expect(() => validateTransition('new', 'contacted', { hasActivity: true })).not.toThrow();
        expect(() => validateTransition('new', 'contacted', { hasActivity: false })).toThrow(TransitionError);
      });

      it('contacted → qualified requires hasRequiredFields', () => {
        expect(() => validateTransition('contacted', 'qualified', { hasRequiredFields: true })).not.toThrow();
        expect(() => validateTransition('contacted', 'qualified', { hasRequiredFields: false })).toThrow(TransitionError);
      });

      it('qualified → won requires hasClient', () => {
        expect(() => validateTransition('qualified', 'won', { hasClient: true })).not.toThrow();
        expect(() => validateTransition('qualified', 'won', { hasClient: false })).toThrow(TransitionError);
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
          validateTransition('contacted', 'qualified', { hasRequiredFields: false });
        } catch (e) {
          expect((e as TransitionError).message).toContain('Requires complete minimum information');
        }
      });

      it('throws specific guard message for missing client conversion', () => {
        try {
          validateTransition('qualified', 'won', { hasClient: false });
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
      expect(TERMINAL_STATUSES).not.toContain('qualified');
    });
  });
});
