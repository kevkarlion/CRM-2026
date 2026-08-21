import mongoose, { Model } from 'mongoose';
import { IRemito } from '../types/remito';
import { remitoSchema } from '../schemas/remito';

const RemitoModel: Model<IRemito> = mongoose.models.Remito || mongoose.model<IRemito>('Remito', remitoSchema);

export default RemitoModel;
