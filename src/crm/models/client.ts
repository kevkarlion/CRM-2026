import mongoose, { Model } from 'mongoose';
import { IClient } from '../types/client';
import { clientSchema } from '../schemas/client';

const ClientModel: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', clientSchema);

export default ClientModel;
