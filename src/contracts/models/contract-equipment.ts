import mongoose, { Model } from 'mongoose';
import { IContractEquipment } from '../types/contract-equipment';
import { contractEquipmentSchema } from '../schemas/contract-equipment';

const ContractEquipmentModel: Model<IContractEquipment> =
  mongoose.models.ContractEquipment || mongoose.model<IContractEquipment>(
  'ContractEquipment',
  contractEquipmentSchema
);

export default ContractEquipmentModel;
