import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface ILocation extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  name: string;
  address: string;
  city: string;
  province: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLocationInput = Omit<
  ILocation,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt'
>;

export type UpdateLocationInput = Partial<Omit<CreateLocationInput, 'tenantId' | 'clientId'>>;
