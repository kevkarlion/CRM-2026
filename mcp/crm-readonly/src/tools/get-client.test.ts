import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

vi.mock('../db.js', () => ({
  getDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { getDb } from '../db.js';
import { handleGetClient } from './get-client.js';

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

describe('handleGetClient', () => {
  it('returns a structured error when no lookup field is provided', async () => {
    const result = await handleGetClient({});
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, phone, or taxId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when no lookup field is provided despite a tenantId', async () => {
    const result = await handleGetClient({ tenantId: TENANT_STR });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('At least one of id, phone, or taxId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error when tenantId is missing despite a lookup', async () => {
    const result = await handleGetClient({ taxId: '30-71234567-8' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('tenantId is required');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('returns a structured error for an invalid id ObjectId', async () => {
    const result = await handleGetClient({ tenantId: TENANT_STR, id: 'not-an-objectid' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Invalid id format');
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('queries the clients collection with tenant + active filters and a lookup', async () => {
    const { findOne, collection } = setupDb();
    await handleGetClient({ tenantId: TENANT_STR, taxId: '30-71234567-8' });
    expect(collection).toHaveBeenCalledWith('clients');
    expect(findOne).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_STR),
      deletedAt: null,
      taxId: '30-71234567-8',
    });
  });

  it('normalizes the phone lookup', async () => {
    const { findOne } = setupDb();
    await handleGetClient({ tenantId: TENANT_STR, phone: '+54 9 299 1234567' });
    expect(findOne).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_STR),
      deletedAt: null,
      phone: '5492991234567',
    });
  });

  it('returns serialized JSON null when no client matches', async () => {
    setupDb(null);
    const result = await handleGetClient({ tenantId: TENANT_STR, id: ID_STR });
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe('null');
  });

  it('returns a structured error on connection failure', async () => {
    mockedGetDb.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const result = await handleGetClient({ tenantId: TENANT_STR, taxId: '30-71234567-8' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Failed to query client: connect ECONNREFUSED');
  });
});