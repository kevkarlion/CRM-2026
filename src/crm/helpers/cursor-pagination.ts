import { Model, FilterQuery, SortOrder } from 'mongoose';
import { CursorPage, CursorOptions } from '../types/common';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface DecodedCursor {
  sortValue: unknown;
  id: string;
}

function encodeCursor(sortValue: unknown, id: string): string {
  const payload = JSON.stringify({ sortValue, id });
  return Buffer.from(payload).toString('base64');
}

function decodeCursor(cursor: string): DecodedCursor {
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    throw new Error('Invalid cursor format');
  }
}

export async function cursorPage<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  options: CursorOptions
): Promise<CursorPage<T>> {
  const limit = Math.min(options.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const sortField = options.sortField || 'createdAt';
  const sortOrder: SortOrder = options.sortOrder ?? -1;

  const queryFilter: FilterQuery<T> = { ...filter };

  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    const operator = sortOrder === -1 ? '$lt' : '$gt';
    (queryFilter as Record<string, unknown>)[sortField] = { [operator]: decoded.sortValue };
  }

  // Fetch one extra to determine hasMore
  const docs = await model
    .find(queryFilter)
    .sort({ [sortField]: sortOrder, _id: sortOrder as 1 | -1 })
    .limit(limit + 1)
    
    .exec();

  const hasMore = docs.length > limit;
  const data = hasMore ? docs.slice(0, limit) : docs;

  const cursor =
    data.length > 0
      ? encodeCursor(
          (data[data.length - 1] as unknown as Record<string, unknown>)[sortField],
          String((data[data.length - 1] as unknown as Record<string, unknown>)._id)
        )
      : null;

  return { data: data as unknown as T[], cursor, hasMore };
}
