import { Schema } from 'mongoose';
import { IContractEquipment } from '../types/contract-equipment';

export const contractEquipmentSchema = new Schema<IContractEquipment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
    includedAt: { type: Date, default: Date.now },
    removedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

contractEquipmentSchema.index({ tenantId: 1, contractId: 1, equipmentId: 1, removedAt: 1 });
contractEquipmentSchema.index({ tenantId: 1, equipmentId: 1, removedAt: 1 });
