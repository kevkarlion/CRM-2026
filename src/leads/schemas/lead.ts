import { Schema } from 'mongoose';
import { ILead, LeadStatus, LeadSource, QualificationStatus, LostReason, InquiryReason, CustomerType, Temperature } from '../types/lead';

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
      enum: ['new', 'contacted', 'quote_sent', 'technical_visit', 'negotiation', 'won', 'lost', 'disqualified'] satisfies LeadStatus[],
      required: true,
      default: 'new',
    },
    isClient: {
      type: Boolean,
      default: false,
    },
    qualificationStatus: {
      type: String,
      enum: ['qualified', 'not_qualified', 'pending'] satisfies QualificationStatus[],
      default: 'pending',
      required: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    lostReason: {
      type: String,
      enum: ['price', 'competitor', 'budget', 'not_interested', 'timing', 'no_response', 'other'] satisfies LostReason[],
    },
    lostDescription: { type: String, trim: true },
    previousLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    estimatedValue: { type: Number, min: 0 },
    notes: { type: String },
    inquiryReason: {
      type: String,
      enum: ['repair', 'maintenance', 'installation', 'budget', 'other'] satisfies InquiryReason[],
    },
    customerType: {
      type: String,
      enum: ['residential', 'commercial'] satisfies CustomerType[],
    },
    temperature: {
      type: String,
      enum: ['hot', 'warm', 'cold'] satisfies Temperature[],
    },
    profileName: { type: String, trim: true },
    address: { type: String, trim: true },
    locality: { type: String, trim: true },
    province: { type: String, trim: true },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
    },
    adminNotes: { type: String, trim: true }, // Notas privadas del administrador
    score: {
      type: Number,
      min: 0,
      default: 0,
    },
    isB2B: {
      type: Boolean,
      default: false,
    },
    scoringBreakdown: {
      buttons: { type: Number, default: 0 },
      property: { type: Number, default: 0 },
      keywords: { type: Number, default: 0 },
      b2b: { type: Number, default: 0 },
    },
    convertedToClient: { type: Schema.Types.ObjectId, ref: 'Client' },
    convertedToWorkOrder: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
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
