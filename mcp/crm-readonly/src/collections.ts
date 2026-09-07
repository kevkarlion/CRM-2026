import { ObjectId, type Document, type Filter } from 'mongodb';
import { normalizePhone } from './phone.js';
import type { ClientLookups, LeadLookups, WorkOrderLookups } from './types.js';

export const COLLECTIONS = {
  leads: 'leads',
  clients: 'clients',
  workOrders: 'workorders',
} as const;

const REQUIRED_LOOKUPS = {
  lead: ['id', 'phone', 'email'],
  client: ['id', 'phone', 'taxId'],
  workOrder: ['id', 'workOrderNumber', 'clientId'],
} as const;

export class MissingLookupError extends Error {
  constructor(required: readonly string[]) {
    super(`At least one of ${required.join(', ')} is required`);
    this.name = 'MissingLookupError';
  }
}

export function activeFilter(tenantId: ObjectId): Filter<Document> {
  return { tenantId, deletedAt: null };
}

export function byId(id: string): { _id: ObjectId } {
  return { _id: new ObjectId(id) };
}

export function byPhone(phone: string): { phone: string } {
  return { phone: normalizePhone(phone) };
}

export function byEmail(email: string): { email: string } {
  return { email: email.toLowerCase() };
}

export function byTaxId(taxId: string): { taxId: string } {
  return { taxId };
}

export function byWorkOrderNumber(workOrderNumber: string): { workOrderNumber: string } {
  return { workOrderNumber };
}

export function byClientId(clientId: string): { clientId: ObjectId } {
  return { clientId: new ObjectId(clientId) };
}

function compile(
  tenantId: ObjectId,
  lookups: Filter<Document>,
  required: readonly string[],
): Filter<Document> {
  if (Object.keys(lookups).length === 0) {
    throw new MissingLookupError(required);
  }
  return { ...activeFilter(tenantId), ...lookups };
}

export function leadQuery(tenantId: string, lookups: LeadLookups): Filter<Document> {
  const tid = new ObjectId(tenantId);
  const filter: Filter<Document> = {};
  if (lookups.id) filter._id = byId(lookups.id)._id;
  if (lookups.phone) filter.phone = byPhone(lookups.phone).phone;
  if (lookups.email) filter.email = byEmail(lookups.email).email;
  return compile(tid, filter, REQUIRED_LOOKUPS.lead);
}

export function clientQuery(tenantId: string, lookups: ClientLookups): Filter<Document> {
  const tid = new ObjectId(tenantId);
  const filter: Filter<Document> = {};
  if (lookups.id) filter._id = byId(lookups.id)._id;
  if (lookups.phone) filter.phone = byPhone(lookups.phone).phone;
  if (lookups.taxId) filter.taxId = byTaxId(lookups.taxId).taxId;
  return compile(tid, filter, REQUIRED_LOOKUPS.client);
}

export function workOrderQuery(tenantId: string, lookups: WorkOrderLookups): Filter<Document> {
  const tid = new ObjectId(tenantId);
  const filter: Filter<Document> = {};
  if (lookups.id) filter._id = byId(lookups.id)._id;
  if (lookups.workOrderNumber) filter.workOrderNumber = byWorkOrderNumber(lookups.workOrderNumber).workOrderNumber;
  if (lookups.clientId) filter.clientId = byClientId(lookups.clientId).clientId;
  return compile(tid, filter, REQUIRED_LOOKUPS.workOrder);
}