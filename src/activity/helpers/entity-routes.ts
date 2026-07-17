const ENTITY_ROUTE_MAP: Record<string, string> = {
  lead: '/leads',
  quote: '/quotes',
  negotiation: '/negotiations',
  work_order: '/work-orders',
  client: '/clients',
  technical_visit: '/technical-visits',
};

export function resolveEntityRoute(entityType: string, entityId: string): string {
  const base = ENTITY_ROUTE_MAP[entityType];
  if (!base || !entityId) return '#';
  return `${base}/${entityId}`;
}

export function getEntityNumber(metadata?: Record<string, unknown>, title?: string): string {
  if (metadata?.number) return `#${metadata.number}`;
  if (metadata?.workOrderNumber) return `#${metadata.workOrderNumber}`;
  return title || '—';
}
