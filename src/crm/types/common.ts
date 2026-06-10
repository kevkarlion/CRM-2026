import { Types } from 'mongoose';

export interface CursorPage<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface CursorOptions {
  limit: number;
  cursor?: string;
  sort?: Record<string, 1 | -1>;
}

export interface IPolymorphicRef {
  entityType: string;
  entityId: Types.ObjectId;
}
