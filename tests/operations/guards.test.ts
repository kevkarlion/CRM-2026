import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  TransitionError,
} from '../../src/operations/helpers/state-machine';

describe('State Machine Guards', () => {
  describe('Checklist guard (assigned → en_route)', () => {
    it('blocks transition when checklist is incomplete', () => {
      expect(() =>
        validateTransition('assigned', 'en_route', {
          hasChecklist: false,
          hasTechnicians: true,
        }),
      ).toThrow(TransitionError);
    });

    it('allows transition when checklist is complete', () => {
      expect(() =>
        validateTransition('assigned', 'en_route', {
          hasChecklist: true,
          hasTechnicians: true,
        }),
      ).not.toThrow();
    });

    it('throws with correct reason when checklist incomplete', () => {
      try {
        validateTransition('assigned', 'en_route', {
          hasChecklist: false,
          hasTechnicians: true,
        });
      } catch (e) {
        const err = e as TransitionError;
        expect(err.from).toBe('assigned');
        expect(err.to).toBe('en_route');
        expect(err.reason).toContain('PreVisitChecklist');
      }
    });
  });

  describe('VisitReport guard (on_site → completed)', () => {
    it('blocks transition when visit report does not exist', () => {
      expect(() =>
        validateTransition('on_site', 'completed', {
          hasVisitReport: false,
        }),
      ).toThrow(TransitionError);
    });

    it('allows transition when visit report exists', () => {
      expect(() =>
        validateTransition('on_site', 'completed', {
          hasVisitReport: true,
        }),
      ).not.toThrow();
    });

    it('throws with correct reason when report missing', () => {
      try {
        validateTransition('on_site', 'completed', {
          hasVisitReport: false,
        });
      } catch (e) {
        const err = e as TransitionError;
        expect(err.from).toBe('on_site');
        expect(err.to).toBe('completed');
        expect(err.reason).toContain('VisitReport');
      }
    });
  });

  describe('Technician guard (* → assigned)', () => {
    it('blocks transition when no technicians assigned', () => {
      expect(() =>
        validateTransition('scheduled', 'assigned', {
          hasTechnicians: false,
        }),
      ).toThrow(TransitionError);
    });

    it('allows transition when technicians are assigned', () => {
      expect(() =>
        validateTransition('scheduled', 'assigned', {
          hasTechnicians: true,
        }),
      ).not.toThrow();
    });

    it('also blocks confirmed → assigned without technicians', () => {
      expect(() =>
        validateTransition('confirmed', 'assigned', {
          hasTechnicians: false,
        }),
      ).toThrow(TransitionError);
    });
  });

  describe('Schedule guard (draft → scheduled)', () => {
    it('blocks transition when schedule fields are missing', () => {
      expect(() =>
        validateTransition('draft', 'scheduled', {
          hasSchedule: false,
        }),
      ).toThrow(TransitionError);
    });

    it('allows transition when schedule fields are present', () => {
      expect(() =>
        validateTransition('draft', 'scheduled', {
          hasSchedule: true,
        }),
      ).not.toThrow();
    });

    it('throws with correct reason when schedule missing', () => {
      try {
        validateTransition('draft', 'scheduled', {
          hasSchedule: false,
        });
      } catch (e) {
        const err = e as TransitionError;
        expect(err.from).toBe('draft');
        expect(err.to).toBe('scheduled');
        expect(err.reason).toContain('scheduledDate');
      }
    });
  });
});
