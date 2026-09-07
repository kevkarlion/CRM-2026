import { ObjectId } from 'mongodb';

export function serializeDoc(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDoc);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = serializeDoc(child);
    }
    return out;
  }
  return value;
}