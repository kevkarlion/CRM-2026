import { Schema } from 'mongoose';
import { ILead, LeadStatus, LeadSource } from '../types/lead';

export const leadSchema = new Schema<ILead>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    source: {
      type: String,
      enum: ['whatsapp', 'call', 'form', 'referral', 'walk_in', 'other'] satisfies LeadSource[],
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost', 'disqualified'] satisfies LeadStatus[],
      required: true,
      default: 'new',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    previousLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    estimatedValue: { type: Number, min: 0 },
    notes: { type: String },
    convertedToClient: { type: Schema.Types.ObjectId, ref: 'Client' },
    convertedAt: { type: Date },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

leadSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ tenantId: 1, email: 1 });
leadSchema.index({ tenantId: 1, phone: 1 });
