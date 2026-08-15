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
  // 1. Limpiar separadores y decodificar
  let cleaned = phone.replace(/%2B/g, '+').replace(/[\s\-\(\)\+]/g, '');
  
  // 2. Quitar leading 0 si existe
  cleaned = cleaned.replace(/^0/, '');
  
  // 3. Detectar números argentinos
  const digits = cleaned.replace(/[^\d]/g, '');
  
  // Si ya tiene prefijo 54, devolver como está (tenga o no 549)
  if (digits.startsWith('54')) {
    return digits;
  }
  
  // Si son 9 dígitos empezando con 9, es un celular sin código de área
  if (digits.length === 9 && digits.startsWith('9')) {
    return '549' + digits;
  }
  
  // Si son 10 dígitos y contienen un 9 que indique celular después del código de área
  // Solo agregar prefijo si el código de área tiene 3+ dígitos (ej: 298, 381, 11)
  // Esto evita confundir teléfonos fijos (0299) con celulares (0298)
  if (digits.length === 10) {
    const nineIndex = digits.indexOf('9');
    // El 9 debe estar después de al menos 3 dígitos de código de área Y ser un celular
    if (nineIndex >= 3 && (digits.length - nineIndex === 8 || digits.length - nineIndex === 9)) {
      return '549' + digits;
    }
  }
  
  return cleaned;
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
  
  // Para números argentinos de 10 dígitos sin prefijo (ej: 2984252859),
  // buscar también por la versión con prefijo 549
  if (digits.length === 10 && !digits.startsWith('54')) {
    const withPrefix = '549' + digits;
    const pattern = `^(${sep}*${digits.split('').join(`${sep}*`)}|${sep}*${withPrefix.split('').join(`${sep}*`)})${sep}*$`;
    return { $regex: new RegExp(pattern, 'i') };
  }
  
  // Si el número tiene 12 dígitos (con prefijo argentino 549), 
  // buscar también por los últimos 10 dígitos (sin prefijo)
  if (digits.length === 12 && digits.startsWith('549')) {
    const withoutPrefix = digits.slice(3); // quito 549, queda 10 dígitos
    const pattern = `^(${sep}*${digits.split('').join(`${sep}*`)}|${sep}*${withoutPrefix.split('').join(`${sep}*`)})${sep}*$`;
    return { $regex: new RegExp(pattern, 'i') };
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
