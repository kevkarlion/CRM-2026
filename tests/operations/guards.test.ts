import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  TransitionError,
} from '../../src/operations/helpers/state-machine';

describe('State Machine Guards', () => {
  describe('Technician guard (* → assigned)', () => {
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

    it('throws with correct reason when no technicians assigned', () => {
      try {
        validateTransition('draft', 'assigned', {
          hasTechnicians: false,
        });
      } catch (e) {
        const err = e as TransitionError;
        expect(err.from).toBe('draft');
        expect(err.to).toBe('assigned');
        expect(err.reason).toContain('technician');
      }
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

  describe('in_progress → completed no longer requires a report guard', () => {
    it('allows completion without any report context', () => {
      expect(() =>
        validateTransition('in_progress', 'completed'),
      ).not.toThrow();
    });

    it('allows completion with an empty context object', () => {
      expect(() =>
        validateTransition('in_progress', 'completed', {}),
      ).not.toThrow();
    });
  });
});
