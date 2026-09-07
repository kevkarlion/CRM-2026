import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
  db: vi.fn(),
}));

vi.mock('mongodb', () => ({
  MongoClient: vi.fn(() => ({ connect: mocks.connect, db: mocks.db })),
}));

import { getDb, closeDb, envFilePath, resolveMongoUri } from './db.js';

const dbObj = { client: { close: mocks.close } };

beforeEach(() => {
  mocks.connect.mockReset();
  mocks.close.mockReset();
  mocks.db.mockReset();
  mocks.connect.mockResolvedValue(undefined);
  mocks.db.mockReturnValue(dbObj);
});

describe('resolveMongoUri', () => {
  it('prefers MONGODB_URI_READONLY over MONGODB_URI', () => {
    expect(
      resolveMongoUri({ MONGODB_URI_READONLY: 'readonly-uri', MONGODB_URI: 'standard-uri' }),
    ).toBe('readonly-uri');
  });

  it('falls back to MONGODB_URI when readonly is not set', () => {
    expect(resolveMongoUri({ MONGODB_URI: 'standard-uri' })).toBe('standard-uri');
  });

  it('returns empty string when neither is set', () => {
    expect(resolveMongoUri({})).toBe('');
  });
});

describe('envFilePath', () => {
  it('resolves to the repo-root .env.local (three levels up from src/dist)', () => {
    const expected = path.resolve(process.cwd(), '../../.env.local');
    expect(envFilePath()).toBe(expected);
    expect(envFilePath().endsWith('CRM 2026/.env.local')).toBe(true);
  });
});

describe('getDb', () => {
  it('throws when no Mongo URI is configured', () => {
    vi.stubEnv('MONGODB_URI_READONLY', undefined);
    vi.stubEnv('MONGODB_URI', undefined);
    expect(() => getDb()).toThrow('Missing MONGODB_URI_READONLY or MONGODB_URI');
    vi.unstubAllEnvs();
  });

  it('reuses the same Db promise (singleton) and connects once', async () => {
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
    await expect(first).resolves.toBe(dbObj);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('resets the singleton after closeDb', async () => {
    await closeDb();
    mocks.connect.mockClear();
    mocks.close.mockClear();

    const dbA = await getDb();
    expect(dbA).toBe(dbObj);
    expect(mocks.connect).toHaveBeenCalledTimes(1);

    await closeDb();
    expect(mocks.close).toHaveBeenCalledTimes(1);

    const dbBack = await getDb();
    expect(dbBack).toBe(dbObj);
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });
});