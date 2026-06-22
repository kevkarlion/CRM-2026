import { Document, Types } from 'mongoose';

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'assigned' | 'statusChanged' | 'rejected';

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  action: ActivityAction;
  actorId: Types.ObjectId;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
