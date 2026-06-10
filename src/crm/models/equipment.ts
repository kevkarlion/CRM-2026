import mongoose, { Model } from 'mongoose';
import { IEquipment } from '../types/equipment';
import { equipmentSchema } from '../schemas/equipment';

const EquipmentModel: Model<IEquipment> = mongoose.model<IEquipment>('Equipment', equipmentSchema);

export default EquipmentModel;
