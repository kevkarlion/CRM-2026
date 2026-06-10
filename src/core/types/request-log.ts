import { Document, Types } from 'mongoose';

export interface IRequestLog extends Document {
  _id: Types.ObjectId;
  method: string;
  endpoint: string;
  duration: number;
  statusCode: number;
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
}
