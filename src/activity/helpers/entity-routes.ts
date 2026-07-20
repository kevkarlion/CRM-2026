const ENTITY_ROUTES: Record<string, string> = {
  quote: '/quotes/',
  negotiation: '/negotiations/',
  visit: '/technical-visits/',
  work_order: '/work-orders/',
  workorder: '/work-orders/',
  lead: '/leads/',
};

export function resolveEntityRoute(
  entityType: string,
  entityId: string,
  leadId?: string,
): string {
  const base = ENTITY_ROUTES[entityType];
  if (!base) return '#';

  const idWithSuffix = `${entityId}${leadId ? `?leadId=${leadId}` : ''}`;
  return `${base}${idWithSuffix}`;
}

export function getEntityNumber(
  metadata?: Record<string, unknown>,
  defaultLabel?: string,
): string {
  if (metadata?.number) return String(metadata.number);
  if (metadata?.workOrderNumber) return String(metadata.workOrderNumber);
  return defaultLabel ?? '';
}
