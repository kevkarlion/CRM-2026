import { Schema } from 'mongoose';
import { IWhatsAppMessage } from '../types/whatsapp-message';

export const whatsappMessageSchema = new Schema<IWhatsAppMessage>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true },
    phone: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'interactive', 'unknown'],
      required: true,
    },
    content: { type: String, default: '' },
    metadata: {
      mediaId: String,
      caption: String,
      filename: String,
      fromMe: Boolean,
      waMessageId: String,
    },
    processedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
whatsappMessageSchema.index({ tenantId: 1, phone: 1, createdAt: -1 });
whatsappMessageSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
whatsappMessageSchema.index({ phone: 1, createdAt: -1 });