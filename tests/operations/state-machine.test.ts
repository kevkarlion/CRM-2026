import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  TransitionError,
  TransitionContext,
} from '../../src/operations/helpers/state-machine';

import { WorkOrderStatus } from '../../src/operations/types/work-order';

const ALL_STATUSES: WorkOrderStatus[] = [
  'draft', 'scheduled', 'confirmed', 'assigned',
  'en_route', 'on_site', 'paused', 'completed', 'cancelled', 'closed',
];

describe('State Machine', () => {
  describe('canTransition', () => {
    it('allows draft → scheduled', () => {
      expect(canTransition('draft', 'scheduled')).toBe(true);
    });

    it('allows draft → cancelled', () => {
      expect(canTransition('draft', 'cancelled')).toBe(true);
    });

    it('allows scheduled → confirmed', () => {
      expect(canTransition('scheduled', 'confirmed')).toBe(true);
    });

    it('allows scheduled → assigned', () => {
      expect(canTransition('scheduled', 'assigned')).toBe(true);
    });

    it('allows scheduled → cancelled', () => {
      expect(canTransition('scheduled', 'cancelled')).toBe(true);
    });

    it('allows confirmed → assigned', () => {
      expect(canTransition('confirmed', 'assigned')).toBe(true);
    });

    it('allows confirmed → cancelled', () => {
      expect(canTransition('confirmed', 'cancelled')).toBe(true);
    });

    it('allows assigned → en_route', () => {
      expect(canTransition('assigned', 'en_route')).toBe(true);
    });

    it('allows assigned → cancelled', () => {
      expect(canTransition('assigned', 'cancelled')).toBe(true);
    });

    it('allows en_route → on_site', () => {
      expect(canTransition('en_route', 'on_site')).toBe(true);
    });

    it('allows en_route → cancelled', () => {
      expect(canTransition('en_route', 'cancelled')).toBe(true);
    });

    it('allows on_site → paused', () => {
      expect(canTransition('on_site', 'paused')).toBe(true);
    });

    it('allows on_site → completed', () => {
      expect(canTransition('on_site', 'completed')).toBe(true);
    });

    it('allows on_site → cancelled', () => {
      expect(canTransition('on_site', 'cancelled')).toBe(true);
    });

    it('allows paused → on_site', () => {
      expect(canTransition('paused', 'on_site')).toBe(true);
    });

    it('allows paused → cancelled', () => {
      expect(canTransition('paused', 'cancelled')).toBe(true);
    });

    it('allows completed → closed', () => {
      expect(canTransition('completed', 'closed')).toBe(true);
    });

    it('blocks cancelled → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'cancelled') continue;
        expect(canTransition('cancelled', target)).toBe(false);
      }
    });

    it('blocks closed → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'closed') continue;
        expect(canTransition('closed', target)).toBe(false);
      }
    });

    it('blocks regression: scheduled → draft', () => {
      expect(canTransition('scheduled', 'draft')).toBe(false);
    });

    it('blocks regression: completed → on_site', () => {
      expect(canTransition('completed', 'on_site')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    const ctx: TransitionContext = {
      hasSchedule: true,
      hasTechnicians: true,
      hasChecklist: true,
      hasVisitReport: true,
    };

    it('passes valid transitions without throwing', () => {
      expect(() => validateTransition('draft', 'scheduled', ctx)).not.toThrow();
      expect(() => validateTransition('on_site', 'completed', ctx)).not.toThrow();
    });

    it('throws TransitionError on invalid transition', () => {
      expect(() => validateTransition('closed', 'draft')).toThrow(TransitionError);
    });

    it('throws TransitionError on regression: scheduled → draft', () => {
      try {
        validateTransition('scheduled', 'draft');
      } catch (e) {
        const err = e as TransitionError;
        expect(err.from).toBe('scheduled');
        expect(err.to).toBe('draft');
        expect(err.reason).toContain('not allowed');
      }
    });

    it('throws TransitionError from terminal cancelled', () => {
      expect(() => validateTransition('cancelled', 'draft')).toThrow(TransitionError);
    });

    it('throws TransitionError from terminal closed', () => {
      expect(() => validateTransition('closed', 'completed')).toThrow(TransitionError);
    });
  });

  describe('VALID_TRANSITIONS table consistency', () => {
    it('every status has an entry', () => {
      for (const status of ALL_STATUSES) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('cancelled and closed have no outgoing transitions', () => {
      expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
      expect(VALID_TRANSITIONS.closed).toHaveLength(0);
    });

    it('terminal statuses match TERMINAL_STATUSES constant', () => {
      for (const s of TERMINAL_STATUSES) {
        expect(VALID_TRANSITIONS[s]).toHaveLength(0);
      }
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('includes cancelled and closed', () => {
      expect(TERMINAL_STATUSES).toContain('cancelled');
      expect(TERMINAL_STATUSES).toContain('closed');
    });
  });
});
