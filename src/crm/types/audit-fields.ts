import { Types } from 'mongoose';

export interface IAuditFields {
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt: Date | null;
}
