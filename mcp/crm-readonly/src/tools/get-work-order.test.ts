import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

vi.mock('../db.js', () => ({
  getDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { getDb } from '../db.js';
import { handleGetWorkOrder } from './get-work-order.js';

const TENANT_STR = '507f1f77bcf86cd799439011';
const ID_STR = '507f1f77bcf86cd799439012';
const CLIENT_ID_STR = '507f1f77bcf86cd799439013';

const mockedGetDb = vi.mocked(getDb);

function text(result: CallToolResult): string {
  const block = result.content[0];
  if (block.type !== 'text') throw new Error('expected a text content block');
  return block.text;
}

function setupDb(findOneResult: unknown = null) {
  const findOne = vi.fn().mockResolvedValue(findOneResult);
  const collection = vi.fn().mockReturnValue({ findOne });
  mockedGetDb.mockResolvedValue({ collection } as never);
  return { findOne, collection };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleGetWorkOrder', () => {
  it('returns a structured error when no lookup field is provided', async () => {
    const result = await handleGetWorkOrder({});
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, workOrderNumber, or clientId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when no lookup field is provided despite a tenantId', async () => {
    const result = await handleGetWorkOrder({ tenantId: TENANT_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, workOrderNumber, or clientId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when tenantId is missing despite a lookup', async () => {
    const result = await handleGetWorkOrder({ workOrderNumber: 'WO-2026-00123' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('tenantId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error for an invalid id ObjectId', async () => {
    const result = await handleGetWorkOrder({ tenantId: TENANT_STR, id: 'not-an-objectid' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Invalid id format');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error for an invalid clientId ObjectId', async () => {
    const result = await handleGetWorkOrder({ tenantId: TENANT_STR, clientId: 'not-an-objectid' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Invalid clientId format');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('queries the workorders collection by workOrderNumber', async () => {
    const { findOne, collection } = setupDb();
    await handleGetWorkOrder({ tenantId: TENANT_STR, workOrderNumber: 'WO-2026-00123' });
    expect(collection).toHaveBeenCalledWith('workorders');
    expect(findOne).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_STR),
      deletedAt: null,
      workOrderNumber: 'WO-2026-00123',
    });
  });

  it('queries by clientId as an ObjectId lookup', async () => {
    const { findOne } = setupDb();
    await handleGetWorkOrder({ tenantId: TENANT_STR, clientId: CLIENT_ID_STR });
    expect(findOne).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_STR),
      deletedAt: null,
      clientId: new ObjectId(CLIENT_ID_STR),
    });
  });

  it('returns the serialized work order document when one is found', async () => {
    setupDb({
      _id: new ObjectId(ID_STR),
      tenantId: new ObjectId(TENANT_STR),
      clientId: new ObjectId(CLIENT_ID_STR),
      workOrderNumber: 'WO-2026-00123',
      status: 'scheduled',
      scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
      deletedAt: null,
    });
    const result = await handleGetWorkOrder({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe(
      JSON.stringify({
        _id: ID_STR,
        tenantId: TENANT_STR,
        clientId: CLIENT_ID_STR,
        workOrderNumber: 'WO-2026-00123',
        status: 'scheduled',
        scheduledDate: '2026-09-01T10:00:00.000Z',
        deletedAt: null,
      }),
    );
  });

  it('returns a structured error on connection failure', async () => {
    mockedGetDb.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const result = await handleGetWorkOrder({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Failed to query work order: connect ECONNREFUSED');
  });
});