import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  COLLECTIONS,
  MissingLookupError,
  activeFilter,
  byId,
  byPhone,
  byEmail,
  byTaxId,
  byWorkOrderNumber,
  byClientId,
  leadQuery,
  clientQuery,
  workOrderQuery,
} from './collections.js';

const TENANT_STR = '507f1f77bcf86cd799439011';
const TENANT = new ObjectId(TENANT_STR);
const ID_STR = '507f1f77bcf86cd799439012';
const ID = new ObjectId(ID_STR);

describe('COLLECTIONS', () => {
  it('maps to the CRM collection names', () => {
    expect(COLLECTIONS).toEqual({ leads: 'leads', clients: 'clients', workOrders: 'workorders' });
  });
});

describe('activeFilter', () => {
  it('merges tenantId and deletedAt: null (not $exists:false)', () => {
    expect(activeFilter(TENANT)).toEqual({ tenantId: TENANT, deletedAt: null });
  });
});

describe('field lookup builders', () => {
  it('byId builds an ObjectId _id filter', () => {
    expect(byId(ID_STR)).toEqual({ _id: ID });
  });

  it('byPhone normalizes the input phone', () => {
    expect(byPhone('+54 9 299 1234567')).toEqual({ phone: '5492991234567' });
  });

  it('byEmail lowercases the email', () => {
    expect(byEmail('TEST@EXAMPLE.COM')).toEqual({ email: 'test@example.com' });
  });

  it('byTaxId passes the string through', () => {
    expect(byTaxId('30-71234567-8')).toEqual({ taxId: '30-71234567-8' });
  });

  it('byWorkOrderNumber passes the string through', () => {
    expect(byWorkOrderNumber('WO-2026-00123')).toEqual({ workOrderNumber: 'WO-2026-00123' });
  });

  it('byClientId builds an ObjectId clientId filter', () => {
    expect(byClientId(ID_STR)).toEqual({ clientId: ID });
  });
});

describe('query builders', () => {
  it('leadQuery by id merges tenant, deletedAt: null, and _id', () => {
    expect(leadQuery(TENANT_STR, { id: ID_STR })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      _id: ID,
    });
  });

  it('leadQuery by phone normalizes and merges', () => {
    expect(leadQuery(TENANT_STR, { phone: '11 2233-4455' })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      phone: '5491122334455',
    });
  });

  it('leadQuery by email lowercases and merges', () => {
    expect(leadQuery(TENANT_STR, { email: 'TEST@EXAMPLE.com' })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      email: 'test@example.com',
    });
  });

  it('clientQuery by taxId merges tenant and deletedAt: null', () => {
    expect(clientQuery(TENANT_STR, { taxId: '30-71234567-8' })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      taxId: '30-71234567-8',
    });
  });

  it('workOrderQuery by clientId builds an ObjectId', () => {
    expect(workOrderQuery(TENANT_STR, { clientId: ID_STR })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      clientId: ID,
    });
  });

  it('workOrderQuery by workOrderNumber passes the string through', () => {
    expect(workOrderQuery(TENANT_STR, { workOrderNumber: 'WO-2026-00123' })).toEqual({
      tenantId: TENANT,
      deletedAt: null,
      workOrderNumber: 'WO-2026-00123',
    });
  });

  it('throws MissingLookupError when no lookup is provided', () => {
    expect(() => leadQuery(TENANT_STR, {})).toThrow(MissingLookupError);
    expect(() => clientQuery(TENANT_STR, {})).toThrow(MissingLookupError);
    expect(() => workOrderQuery(TENANT_STR, {})).toThrow(MissingLookupError);
  });

  it('MissingLookupError lists the required fields', () => {
    try {
      leadQuery(TENANT_STR, {});
    } catch (err) {
      expect((err as Error).message).toBe('At least one of id, phone, email is required');
    }
  });
});