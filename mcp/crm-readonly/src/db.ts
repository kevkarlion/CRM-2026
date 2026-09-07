import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MongoClient, type Db } from 'mongodb';

const ENV_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.env.local',
);

dotenv.config({ path: ENV_FILE });

export function envFilePath(): string {
  return ENV_FILE;
}

export function resolveMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  return env.MONGODB_URI_READONLY ?? env.MONGODB_URI ?? '';
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  const uri = resolveMongoUri();
  if (!uri) {
    throw new Error('Missing MONGODB_URI_READONLY or MONGODB_URI');
  }
  if (!dbPromise) {
    const client = new MongoClient(uri);
    dbPromise = client.connect().then(() => client.db());
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  await db.client.close();
}