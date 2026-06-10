import { Schema } from 'mongoose';
import { IPermission } from '../types/permission';

export const permissionSchema = new Schema<IPermission>(
  {
    key: { type: String, required: true, unique: true },
    group: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

// Indexes
permissionSchema.index({ group: 1 });
