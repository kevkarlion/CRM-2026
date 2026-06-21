import { QuoteStatus } from '../types/quote';

export const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['approved', 'rejected', 'expired', 'cancelled'],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: QuoteStatus[] = [
  'approved', 'rejected', 'expired', 'cancelled',
];

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly from: QuoteStatus,
    public readonly to: QuoteStatus,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (from === to) {
    throw new TransitionError(
      `Auto-transición no permitida: ${from} → ${to}`,
      from, to,
      `La cotización ya está en estado '${from}'.`,
    );
  }
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Transición inválida: ${from} → ${to}`,
      from, to,
      `La transición de '${from}' a '${to}' no está permitida por la máquina de estados.`,
    );
  }
}

export function validateSendRequirements(quote: {
  items: unknown[];
  clientId: unknown;
  validUntil: Date | null;
}): void {
  const missing: string[] = [];
  if (!quote.items?.length) missing.push('items');
  if (!quote.clientId) missing.push('clientId');
  if (quote.validUntil && quote.validUntil <= new Date()) {
    missing.push('validUntil no vencido');
  }
  if (missing.length > 0) {
    throw new TransitionError(
      `Campos requeridos faltantes: ${missing.join(', ')}`,
      'draft', 'sent',
      `Se requiere ${missing.join(', ')} para enviar la cotización.`,
    );
  }
}

export function validateApproveRequirements(quote: {
  validUntil: Date | null;
}): void {
  if (quote.validUntil && quote.validUntil <= new Date()) {
    throw new TransitionError(
      'La cotización ha expirado',
      'sent', 'approved',
      'No se puede aprobar una cotización vencida. Cree una nueva cotización.',
    );
  }
}
