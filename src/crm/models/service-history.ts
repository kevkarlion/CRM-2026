import mongoose, { Model } from 'mongoose';
import { IServiceHistory } from '../types/service-history';
import { serviceHistorySchema } from '../schemas/service-history';

const ServiceHistoryModel: Model<IServiceHistory> = mongoose.model<IServiceHistory>(
  'ServiceHistory',
  serviceHistorySchema
);

export default ServiceHistoryModel;
