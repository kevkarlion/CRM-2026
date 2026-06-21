import { LeadStatus } from '../types/lead';

export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['won', 'lost'],
  won: [],
  lost: [],
  disqualified: [],
};

export const TERMINAL_STATUSES: LeadStatus[] = ['won', 'lost', 'disqualified'];

export class TransitionError extends Error {
  constructor(from: LeadStatus, to: LeadStatus, reason: string) {
    super(`Cannot transition from ${from} to ${to}: ${reason}`);
    this.name = 'TransitionError';
  }
}

export interface TransitionContext {
  hasActivity?: boolean;
  hasRequiredFields?: boolean;
  hasClient?: boolean;
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: LeadStatus, to: LeadStatus, context?: TransitionContext): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(from, to, `Invalid transition`);
  }

  if (from === 'new' && to === 'contacted' && context && !context.hasActivity) {
    throw new TransitionError(from, to, 'Requires at least one activity record');
  }

  if (from === 'contacted' && to === 'qualified' && context && !context.hasRequiredFields) {
    throw new TransitionError(from, to, 'Requires complete minimum information (name, email/phone, source)');
  }

  if (from === 'qualified' && to === 'won' && context && !context.hasClient) {
    throw new TransitionError(from, to, 'Cannot mark as won without converting to Client first');
  }
}
