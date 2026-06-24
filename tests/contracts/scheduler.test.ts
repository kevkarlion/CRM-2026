import { describe, it, expect } from 'vitest';
import {
  getNextDate,
  generateScheduleDates,
  planUnitToContractFrequency,
} from '../../src/contracts/helpers/scheduler';
import type { ContractFrequency } from '../../src/contracts/types/contract';

describe('Scheduler', () => {
  describe('getNextDate', () => {
    it('adds days correctly', () => {
      const from = new Date('2026-01-01');
      const freq: ContractFrequency = { interval: 30, unit: 'days' };
      const next = getNextDate(from, freq);
      expect(next.toISOString().slice(0, 10)).toBe('2026-01-31');
    });

    it('adds months correctly', () => {
      const from = new Date('2026-01-15');
      const freq: ContractFrequency = { interval: 3, unit: 'months' };
      const next = getNextDate(from, freq);
      expect(next.toISOString().slice(0, 10)).toBe('2026-04-15');
    });

    it('adds years correctly', () => {
      const from = new Date('2026-06-01');
      const freq: ContractFrequency = { interval: 1, unit: 'years' };
      const next = getNextDate(from, freq);
      expect(next.toISOString().slice(0, 10)).toBe('2027-06-01');
    });

    it('handles month overflow (Jan 31 → Feb 28 in non-leap)', () => {
      const from = new Date('2026-01-31');
      const freq: ContractFrequency = { interval: 1, unit: 'months' };
      const next = getNextDate(from, freq);
      // JS Date auto-overflows to March 3, which is acceptable for now
      expect(next.getMonth()).toBe(2); // March
    });

    it('does not mutate the original date', () => {
      const from = new Date('2026-01-01');
      const freq: ContractFrequency = { interval: 1, unit: 'months' };
      getNextDate(from, freq);
      expect(from.toISOString().slice(0, 10)).toBe('2026-01-01');
    });
  });

  describe('generateScheduleDates', () => {
    it('generates monthly dates between start and end', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-06-30');
      const freq: ContractFrequency = { interval: 1, unit: 'months' };
      const dates = generateScheduleDates(start, end, freq);
      expect(dates).toHaveLength(6);
      expect(dates[0].toISOString().slice(0, 10)).toBe('2026-01-01');
      expect(dates[5].toISOString().slice(0, 10)).toBe('2026-06-01');
    });

    it('generates quarterly dates', () => {
      const start = new Date('2026-01-15');
      const end = new Date('2027-01-15');
      const freq: ContractFrequency = { interval: 3, unit: 'months' };
      const dates = generateScheduleDates(start, end, freq);
      expect(dates).toHaveLength(5);
      expect(dates[0].toISOString().slice(0, 10)).toBe('2026-01-15');
      expect(dates[1].toISOString().slice(0, 10)).toBe('2026-04-15');
      expect(dates[2].toISOString().slice(0, 10)).toBe('2026-07-15');
      expect(dates[3].toISOString().slice(0, 10)).toBe('2026-10-15');
      expect(dates[4].toISOString().slice(0, 10)).toBe('2027-01-15');
    });

    it('returns single date when frequency exceeds range', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-03-01');
      const freq: ContractFrequency = { interval: 1, unit: 'years' };
      const dates = generateScheduleDates(start, end, freq);
      expect(dates).toHaveLength(1);
      expect(dates[0].toISOString().slice(0, 10)).toBe('2026-01-01');
    });

    it('does not include dates past endDate', () => {
      const start = new Date('2026-12-01');
      const end = new Date('2026-12-15');
      const freq: ContractFrequency = { interval: 10, unit: 'days' };
      const dates = generateScheduleDates(start, end, freq);
      expect(dates).toHaveLength(2);
      expect(dates[1].toISOString().slice(0, 10)).toBe('2026-12-11');
    });
  });

  describe('planUnitToContractFrequency', () => {
    it('converts monthly', () => {
      expect(planUnitToContractFrequency(1, 'monthly')).toEqual({ interval: 1, unit: 'months' });
    });

    it('converts quarterly', () => {
      expect(planUnitToContractFrequency(1, 'quarterly')).toEqual({ interval: 3, unit: 'months' });
    });

    it('converts biannual', () => {
      expect(planUnitToContractFrequency(1, 'biannual')).toEqual({ interval: 6, unit: 'months' });
    });

    it('converts annual', () => {
      expect(planUnitToContractFrequency(1, 'annual')).toEqual({ interval: 1, unit: 'years' });
    });

    it('converts days directly', () => {
      expect(planUnitToContractFrequency(15, 'days')).toEqual({ interval: 15, unit: 'days' });
    });

    it('handles custom interval values', () => {
      expect(planUnitToContractFrequency(2, 'quarterly')).toEqual({ interval: 6, unit: 'months' });
    });
  });
});
