import mongoose, { Model } from 'mongoose';
import type { IClientServiceHistory } from '../types/client-service-history';
import { clientServiceHistorySchema } from '../schemas/client-service-history';

const ClientServiceHistoryModel: Model<IClientServiceHistory> =
  mongoose.models.ClientServiceHistory ||
  mongoose.model<IClientServiceHistory>('ClientServiceHistory', clientServiceHistorySchema);

export default ClientServiceHistoryModel;