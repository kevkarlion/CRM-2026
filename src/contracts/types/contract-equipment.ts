import { Document, Types } from 'mongoose';

export interface IContractEquipment extends Document {
  tenantId: Types.ObjectId;
  contractId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  includedAt: Date;
  removedAt: Date | null;
}

export interface AddEquipmentInput {
  equipmentId: Types.ObjectId;
}
