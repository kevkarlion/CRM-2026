import mongoose, { Model } from 'mongoose';
import { IRequestLog } from '../types/request-log';
import { requestLogSchema } from '../schemas/request-log';

const RequestLogModel: Model<IRequestLog> = mongoose.model<IRequestLog>(
  'RequestLog',
  requestLogSchema
);

export default RequestLogModel;
