import mongoose, { Model } from 'mongoose';
import { IContract } from '../types/contract';
import { contractSchema } from '../schemas/contract';

const ContractModel: Model<IContract> = mongoose.models.Contract || mongoose.model<IContract>('Contract', contractSchema);

export default ContractModel;
