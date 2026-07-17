import { Schema, model, models, type Model } from 'mongoose';
import { ITenant } from '@/core/types/tenant';

export interface ITechnician {
  _id: import('mongoose').Types.ObjectId;
  tenantId: import('mongoose').Types.ObjectId;
  userId?: import('mongoose').Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  specialties: string[];
  zones: string[];
  status: 'active' | 'inactive' | 'on_leave';
  availability: 'available' | 'busy' | 'unavailable';
  maxDailyWorkOrders: number;
  createdBy: import('mongoose').Types.ObjectId;
  updatedBy: import('mongoose').Types.ObjectId;
  deletedAt?: Date;
  deletedBy?: import('mongoose').Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const technicianSchema = new Schema<ITechnician>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    specialties: [{ type: String }],
    zones: [{ type: String }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave'],
      default: 'active',
    },
    availability: {
      type: String,
      enum: ['available', 'busy', 'unavailable'],
      default: 'available',
    },
    maxDailyWorkOrders: { type: Number, default: 5 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

// Indexes
technicianSchema.index({ tenantId: 1, status: 1 });
technicianSchema.index({ tenantId: 1, availability: 1 });
technicianSchema.index({ tenantId: 1, userId: 1 }, { unique: true, sparse: true });
technicianSchema.index({ tenantId: 1, specialties: 1 });

export const TechnicianModel: Model<ITechnician> =
  models.Technician || model<ITechnician>('Technician', technicianSchema);