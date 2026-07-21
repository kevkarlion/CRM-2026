import { Types } from 'mongoose';

export interface ITechnician {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  specialties: string[];
  zones: string[];
  status: 'active' | 'inactive' | 'on_leave';
  availability: 'available' | 'busy' | 'unavailable';
  maxDailyWorkOrders: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
