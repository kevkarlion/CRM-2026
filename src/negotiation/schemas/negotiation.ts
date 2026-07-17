import { Schema } from 'mongoose';
import { INegotiation, NEGOTIATION_STATUSES } from '../types/negotiation';

const CounterOfferSchema = new Schema({
  amount: { type: Number, required: true },
  discountFixed: { type: Number, min: 0 },
  discountPercent: { type: Number, min: 0, max: 100 },
  terms: { type: String, required: true },
  reason: String,
  internalNotes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  validUntil: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'],
    required: true,
    default: 'pending',
  },
  respondedAt: Date,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CommercialEventSchema = new Schema({
  eventType: {
    type: String,
    enum: [
      'discount_request', 'financing_request', 'scope_change',
      'needs_time', 'technical_query', 'new_visit_request',
      'accepted_conditions', 'rejected_conditions', 'other',
    ],
    required: true,
  },
  description: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const FollowUpSchema = new Schema({
  nextContactDate: Date,
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  internalNotes: String,
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false });

export const negotiationSchema = new Schema<INegotiation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote' },
    status: {
      type: String,
      enum: NEGOTIATION_STATUSES,
      required: true,
      default: 'open',
    },
    counterOffers: { type: [CounterOfferSchema], default: [] },
    commercialEvents: { type: [CommercialEventSchema], default: [] },
    followUp: { type: FollowUpSchema, default: null },
    discountAmount: { type: Number, min: 0 },
    validUntil: Date,
    terms: String,
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

negotiationSchema.index({ tenantId: 1, status: 1 });
negotiationSchema.index({ tenantId: 1, leadId: 1 });
negotiationSchema.index({ tenantId: 1, deletedAt: 1 });
negotiationSchema.index({ tenantId: 1, 'counterOffers.status': 1 });
negotiationSchema.index({ tenantId: 1, 'followUp.nextContactDate': 1, 'followUp.assignedTo': 1 });
