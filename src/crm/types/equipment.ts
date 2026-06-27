import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface IEquipment extends Omit<Document, 'model'>, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId;
  equipmentType: 'split' | 'multisplit' | 'boiler' | 'chiller' | 'rooftop' | 'industrial';
  brand?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: Date;
  warrantyExpiration?: Date;
  status: 'active' | 'inactive' | 'under_repair' | 'retired';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateEquipmentInput = Omit<
  IEquipment,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'clientId'
> & { clientId?: string };

export type UpdateEquipmentInput = Partial<Omit<CreateEquipmentInput, 'tenantId'>>;
