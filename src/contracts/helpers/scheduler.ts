import { ContractFrequency } from '../types/contract';
import { FrequencyUnit } from '../types/maintenance-plan';

/**
 * Calculates the next scheduled date based on frequency configuration.
 */
export function getNextDate(from: Date, frequency: ContractFrequency): Date {
  const next = new Date(from);

  switch (frequency.unit) {
    case 'days':
      next.setDate(next.getDate() + frequency.interval);
      break;
    case 'months':
      next.setMonth(next.getMonth() + frequency.interval);
      break;
    case 'years':
      next.setFullYear(next.getFullYear() + frequency.interval);
      break;
  }

  return next;
}

/**
 * Converts a MaintenancePlan frequency unit to Contract frequency (days).
 * Used when generating schedules from maintenance plans.
 */
export function planUnitToContractFrequency(interval: number, unit: FrequencyUnit): ContractFrequency {
  switch (unit) {
    case 'monthly':
      return { interval, unit: 'months' };
    case 'quarterly':
      return { interval: interval * 3, unit: 'months' };
    case 'biannual':
      return { interval: interval * 6, unit: 'months' };
    case 'annual':
      return { interval, unit: 'years' };
    case 'days':
      return { interval, unit: 'days' };
  }
}

/**
 * Generates all scheduled dates between startDate and endDate based on frequency.
 * Does NOT include dates past endDate.
 */
export function generateScheduleDates(
  startDate: Date,
  endDate: Date,
  frequency: ContractFrequency
): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current = getNextDate(current, frequency);
  }

  return dates;
}
