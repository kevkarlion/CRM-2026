import { Schema } from 'mongoose';
import { IWhatsAppTemplate, IWhatsAppTemplateVariable, WhatsAppTemplateCategory } from '../types/whatsapp-template';

const whatsappTemplateVariableSchema = new Schema<IWhatsAppTemplateVariable>(
  {
    index: {
      type: Number,
      required: true,
      min: 1,
    },
    field: {
      type: String,
      required: true,
    },
    defaultValue: {
      type: String,
      required: false,
    },
  },
  { _id: false }
);

export const whatsappTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
      default: 'es',
    },
    category: {
      type: String,
      enum: ['TRANSACTIONAL', 'MARKETING', 'AUTHENTICATION'] satisfies WhatsAppTemplateCategory[],
      default: 'TRANSACTIONAL',
    },
    content: {
      type: String,
      required: false,
      description: 'Full template text from Meta with {{1}}, {{2}}, etc.',
    },
    variables: {
      type: [whatsappTemplateVariableSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Compound indexes for efficient queries
whatsappTemplateSchema.index({ tenantId: 1, name: 1, language: 1 }, { unique: true });
whatsappTemplateSchema.index({ tenantId: 1, isActive: 1 });
whatsappTemplateSchema.index({ tenantId: 1, category: 1 });
