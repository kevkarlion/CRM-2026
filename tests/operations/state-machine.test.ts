import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  CANONICAL_STATUSES,
  getReachableDestinations,
  TransitionError,
  TransitionContext,
} from '../../src/operations/helpers/state-machine';

import { WorkOrderStatus } from '../../src/operations/types/work-order';

const ALL_STATUSES: WorkOrderStatus[] = [
  'draft', 'scheduled', 'assigned', 'in_progress',
  'paused', 'completed', 'cancelled', 'closed',
];

describe('State Machine', () => {
  describe('canTransition', () => {
    it('allows draft → scheduled', () => {
      expect(canTransition('draft', 'scheduled')).toBe(true);
    });

    it('allows draft → assigned', () => {
      expect(canTransition('draft', 'assigned')).toBe(true);
    });

    it('allows draft → cancelled', () => {
      expect(canTransition('draft', 'cancelled')).toBe(true);
    });

    it('allows scheduled → assigned', () => {
      expect(canTransition('scheduled', 'assigned')).toBe(true);
    });

    it('allows scheduled → in_progress', () => {
      expect(canTransition('scheduled', 'in_progress')).toBe(true);
    });

    it('allows scheduled → cancelled', () => {
      expect(canTransition('scheduled', 'cancelled')).toBe(true);
    });

    it('allows assigned → cancelled', () => {
      expect(canTransition('assigned', 'cancelled')).toBe(true);
    });

    it('allows assigned → in_progress (canonical, not legacy shadowed)', () => {
      expect(canTransition('assigned', 'in_progress')).toBe(true);
    });

    it('blocks assigned → scheduled without context (protected regression edge)', () => {
      expect(canTransition('assigned', 'scheduled')).toBe(false);
    });

    it('blocks assigned → draft without context (protected regression edge)', () => {
      expect(canTransition('assigned', 'draft')).toBe(false);
    });

    it('allows in_progress → paused', () => {
      expect(canTransition('in_progress', 'paused')).toBe(true);
    });

    it('allows in_progress → completed', () => {
      expect(canTransition('in_progress', 'completed')).toBe(true);
    });

    it('allows in_progress → closed (canonical terminal)', () => {
      expect(canTransition('in_progress', 'closed')).toBe(true);
    });

    it('allows in_progress → cancelled', () => {
      expect(canTransition('in_progress', 'cancelled')).toBe(true);
    });

    it('allows paused → in_progress', () => {
      expect(canTransition('paused', 'in_progress')).toBe(true);
    });

    it('allows paused → cancelled', () => {
      expect(canTransition('paused', 'cancelled')).toBe(true);
    });

    it('blocks cancelled → any status', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'cancelled') continue;
        expect(canTransition('cancelled', target)).toBe(false);
      }
    });

    it('blocks closed → any status (terminal)', () => {
      for (const target of ALL_STATUSES) {
        if (target === 'closed') continue;
        expect(canTransition('closed', target)).toBe(false);
      }
    });

    it('blocks completed → closed (completed already terminal)', () => {
      expect(canTransition('completed', 'closed')).toBe(false);
    });

    it('blocks regression: scheduled → draft', () => {
      expect(canTransition('scheduled', 'draft')).toBe(false);
    });

    it('blocks regression: completed → in_progress', () => {
      expect(canTransition('completed', 'in_progress')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    const ctx: TransitionContext = {
      hasSchedule: true,
      hasTechnicians: true,
      hasChecklist: true,
    };

    it('passes valid transitions without throwing', () => {
      expect(() => validateTransition('draft', 'scheduled', ctx)).not.toThrow();
      expect(() => validateTransition('in_progress', 'closed', ctx)).not.toThrow();
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

    it('terminal statuses have no outgoing transitions', () => {
      expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
      expect(VALID_TRANSITIONS.closed).toHaveLength(0);
      expect(VALID_TRANSITIONS.completed).toHaveLength(0);
    });

    it('terminal statuses match TERMINAL_STATUSES constant', () => {
      for (const s of TERMINAL_STATUSES) {
        expect(VALID_TRANSITIONS[s]).toHaveLength(0);
      }
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('includes cancelled, closed, and completed (alias)', () => {
      expect(TERMINAL_STATUSES).toContain('cancelled');
      expect(TERMINAL_STATUSES).toContain('closed');
      expect(TERMINAL_STATUSES).toContain('completed');
    });
  });

  describe('CANONICAL_STATUSES', () => {
    it('is a single matrix covering every WorkOrderStatus', () => {
      expect(CANONICAL_STATUSES).toEqual(ALL_STATUSES);
    });

    it('every canonical status has a VALID_TRANSITIONS entry', () => {
      for (const status of CANONICAL_STATUSES) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
      }
    });
  });

  describe('Guarded regression edges (assigned → scheduled|draft)', () => {
    it('passes assigned → scheduled with hasTechnicians:false', () => {
      expect(() =>
        validateTransition('assigned', 'scheduled', { hasTechnicians: false }),
      ).not.toThrow();
    });

    it('throws assigned → scheduled with hasTechnicians:true', () => {
      expect(() =>
        validateTransition('assigned', 'scheduled', { hasTechnicians: true }),
      ).toThrow(TransitionError);
    });

    it('passes assigned → draft with hasTechnicians:false', () => {
      expect(() =>
        validateTransition('assigned', 'draft', { hasTechnicians: false }),
      ).not.toThrow();
    });

    it('throws assigned → draft with hasTechnicians:true', () => {
      expect(() =>
        validateTransition('assigned', 'draft', { hasTechnicians: true }),
      ).toThrow(TransitionError);
    });
  });

  describe('Checklist guard resumes for scheduled|assigned → in_progress', () => {
    it('blocks assigned → in_progress when the checklist is missing', () => {
      expect(() =>
        validateTransition('assigned', 'in_progress', {}),
      ).toThrow(TransitionError);
    });

    it('allows assigned → in_progress when the checklist is complete', () => {
      expect(() =>
        validateTransition('assigned', 'in_progress', { hasChecklist: true }),
      ).not.toThrow();
    });

    it('allows scheduled → in_progress when the checklist is complete', () => {
      expect(() =>
        validateTransition('scheduled', 'in_progress', { hasChecklist: true }),
      ).not.toThrow();
    });
  });

  describe('getReachableDestinations', () => {
    it('returns the base destinations for assigned', () => {
      expect(getReachableDestinations('assigned')).toEqual([
        'in_progress', 'paused', 'cancelled',
      ]);
    });

    it('exposes guarded regression edges only when no technicians remain', () => {
      expect(getReachableDestinations('assigned', { hasTechnicians: false })).toContain('scheduled');
      expect(getReachableDestinations('assigned', { hasTechnicians: false })).toContain('draft');
      expect(getReachableDestinations('assigned', { hasTechnicians: true })).not.toContain('scheduled');
    });

    it('keeps in_progress → closed reachable', () => {
      expect(getReachableDestinations('in_progress')).toContain('closed');
      expect(getReachableDestinations('in_progress')).toContain('completed');
    });

    it('terminal statuses expose no destinations', () => {
      expect(getReachableDestinations('completed')).toEqual([]);
      expect(getReachableDestinations('closed')).toEqual([]);
      expect(getReachableDestinations('cancelled')).toEqual([]);
    });

    it('draft exposes scheduling, assignment and cancellation', () => {
      const reachable = getReachableDestinations('draft');
      expect(reachable).toContain('scheduled');
      expect(reachable).toContain('assigned');
      expect(reachable).toContain('cancelled');
    });
  });
});
