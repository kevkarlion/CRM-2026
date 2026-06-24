import { ContractStatus } from '../types/contract';

type TransitionMap = Record<ContractStatus, ContractStatus[]>;

/**
 * Allowed state transitions for Contract status.
 *
 * draft    → active (requires valid dates + clientId)
 * active   → paused | expired | cancelled
 * paused   → active | cancelled
 * expired  → (terminal)
 * cancelled → (terminal)
 */
const TRANSITIONS: TransitionMap = {
  draft: ['active'],
  active: ['paused', 'expired', 'cancelled'],
  paused: ['active', 'cancelled'],
  expired: [],
  cancelled: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: ContractStatus): ContractStatus[] {
  return TRANSITIONS[status] ?? [];
}

export function isValidStatus(status: string): status is ContractStatus {
  return Object.keys(TRANSITIONS).includes(status);
}
