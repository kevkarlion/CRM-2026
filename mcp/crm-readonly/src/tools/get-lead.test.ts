import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

vi.mock('../db.js', () => ({
  getDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { getDb } from '../db.js';
import { handleGetLead } from './get-lead.js';

const TENANT_STR = '507f1f77bcf86cd799439011';
const ID_STR = '507f1f77bcf86cd799439012';

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

describe('handleGetLead', () => {
  it('returns a structured error when no lookup field is provided', async () => {
    const result = await handleGetLead({});
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, phone, or email is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when no lookup field is provided despite a tenantId', async () => {
    const result = await handleGetLead({ tenantId: TENANT_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, phone, or email is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when tenantId is missing despite a lookup', async () => {
    const result = await handleGetLead({ id: ID_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('tenantId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error for an invalid tenantId ObjectId', async () => {
    const result = await handleGetLead({ tenantId: 'not-an-objectid', id: ID_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Invalid tenantId format');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error for an invalid id ObjectId', async () => {
    const result = await handleGetLead({ tenantId: TENANT_STR, id: 'not-an-objectid' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Invalid id format');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('queries the leads collection with tenant + active filters and a lookup', async () => {
    const { findOne, collection } = setupDb();
    await handleGetLead({ tenantId: TENANT_STR, email: 'TEST@EXAMPLE.com' });
    expect(collection).toHaveBeenCalledWith('leads');
    expect(findOne).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_STR),
      deletedAt: null,
      email: 'test@example.com',
    });
  });

  it('returns serialized JSON null when no lead matches', async () => {
    setupDb(null);
    const result = await handleGetLead({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe('null');
  });

  it('returns the serialized lead document when one is found', async () => {
    setupDb({
      _id: new ObjectId(ID_STR),
      tenantId: new ObjectId(TENANT_STR),
      name: 'Ada',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
    });
    const result = await handleGetLead({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe(
      JSON.stringify({
        _id: ID_STR,
        tenantId: TENANT_STR,
        name: 'Ada',
        createdAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      }),
    );
  });

  it('returns a structured error on connection failure', async () => {
    mockedGetDb.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const result = await handleGetLead({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Failed to query lead: connect ECONNREFUSED');
  });
});