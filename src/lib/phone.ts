export type PhoneCollider = {
  type: 'lead' | 'client';
  id: string;
  name: string;
  status: string;
  active: boolean;
};

export type PhoneCollisionWarning = {
  type: 'lead' | 'client';
  id: string;
  name: string;
  status: string;
};

export function normalizePhone(phone: string): string {
  return phone.replace(/%2B/g, '+').replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
}

export function phoneMatchQuery(normalized: string): { $regex: RegExp } {
  if (!normalized) {
    return { $regex: /(?!)/ };
  }
  const sep = '[\\s\\-\\(\\)\\+]';
  const digits = normalized.replace(/[^\d]/g, '');
  if (!digits) {
    return { $regex: /(?!)/ };
  }
  const pattern = `^${sep}*${digits.split('').join(`${sep}*`)}${sep}*$`;
  return { $regex: new RegExp(pattern, 'i') };
}

const ACTIVE_LEAD_STATUSES = new Set([
  'new',
  'contacted',
  'quote_sent',
  'technical_visit',
  'negotiation',
]);

export function isActiveLead(lead: { status?: string; deletedAt?: Date | null }): boolean {
  return Boolean(lead && !lead.deletedAt && lead.status && ACTIVE_LEAD_STATUSES.has(lead.status));
}

export function isActiveClient(client: { deletedAt?: Date | null }): boolean {
  return Boolean(client && !client.deletedAt);
}
