import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  isValidStatus,
} from '../../src/contracts/helpers/state-machine';
import type { ContractStatus } from '../../src/contracts/types/contract';

const ALL_STATUSES: ContractStatus[] = ['draft', 'active', 'paused', 'expired', 'cancelled'];

describe('Contract State Machine', () => {
  describe('canTransition', () => {
    it('allows draft → active', () => {
      expect(canTransition('draft', 'active')).toBe(true);
    });

    it('allows active → paused', () => {
      expect(canTransition('active', 'paused')).toBe(true);
    });

    it('allows active → expired', () => {
      expect(canTransition('active', 'expired')).toBe(true);
    });

    it('allows active → cancelled', () => {
      expect(canTransition('active', 'cancelled')).toBe(true);
    });

    it('allows paused → active', () => {
      expect(canTransition('paused', 'active')).toBe(true);
    });

    it('allows paused → cancelled', () => {
      expect(canTransition('paused', 'cancelled')).toBe(true);
    });

    it('blocks draft → paused (skips active)', () => {
      expect(canTransition('draft', 'paused')).toBe(false);
    });

    it('blocks draft → cancelled', () => {
      expect(canTransition('draft', 'cancelled')).toBe(false);
    });

    it('blocks draft → expired', () => {
      expect(canTransition('draft', 'expired')).toBe(false);
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

    it('blocks paused → expired', () => {
      expect(canTransition('paused', 'expired')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns [active] for draft', () => {
      expect(getAllowedTransitions('draft')).toEqual(['active']);
    });

    it('returns [paused, expired, cancelled] for active', () => {
      expect(getAllowedTransitions('active')).toEqual(['paused', 'expired', 'cancelled']);
    });

    it('returns [active, cancelled] for paused', () => {
      expect(getAllowedTransitions('paused')).toEqual(['active', 'cancelled']);
    });

    it('returns [] for expired', () => {
      expect(getAllowedTransitions('expired')).toEqual([]);
    });

    it('returns [] for cancelled', () => {
      expect(getAllowedTransitions('cancelled')).toEqual([]);
    });
  });

  describe('isValidStatus', () => {
    it('returns true for all valid statuses', () => {
      for (const status of ALL_STATUSES) {
        expect(isValidStatus(status)).toBe(true);
      }
    });

    it('returns false for invalid status', () => {
      expect(isValidStatus('unknown')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('archived')).toBe(false);
    });
  });
});
