import { Schema } from 'mongoose';
import { normalizePhone } from '@/lib/phone';
import { IGestion, GestionStatus, GestionSource, QualificationStatus, LostReason, InquiryReason, CustomerType, Temperature } from '../types/gestion';

export const gestionSchema = new Schema<IGestion>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    originalLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' }, // Link to original lead for conversation tracking
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    source: {
      type: String,
      enum: ['whatsapp', 'call', 'form', 'referral', 'walk_in', 'other'] satisfies GestionSource[],
      default: 'whatsapp',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] satisfies GestionStatus[],
      required: true,
      default: 'new',
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
    previousGestionId: { type: Schema.Types.ObjectId, ref: 'Gestion' },
    estimatedValue: { type: Number, min: 0 },
    notes: { type: String },
    inquiryReason: {
      type: String, // Allow free text for lead conversion notes
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
    adminNotes: { type: String, trim: true },
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
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// Allow multiple Gestions per client - the "active" one is determined by status
// Only non-terminal Gestions (not won/lost) are considered active
gestionSchema.index({ tenantId: 1, clientId: 1 });
gestionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
gestionSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });
gestionSchema.index({ tenantId: 1, email: 1 });
gestionSchema.index({ tenantId: 1, phone: 1 });

gestionSchema.pre('save', function (next) {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

gestionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as {
    phone?: unknown;
    $set?: { phone?: unknown };
    $setOnInsert?: { phone?: unknown };
  } | null;
  if (update && update.phone) {
    update.phone = normalizePhone(String(update.phone));
  }
  if (update && update.$set && update.$set.phone) {
    update.$set.phone = normalizePhone(String(update.$set.phone));
  }
  if (update && update.$setOnInsert && update.$setOnInsert.phone) {
    update.$setOnInsert.phone = normalizePhone(String(update.$setOnInsert.phone));
  }
  next();
});