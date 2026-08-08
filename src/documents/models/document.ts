import mongoose, { Schema, Document as MongoDocument } from 'mongoose';
import { IDocument, DocumentType, DocumentSource } from '../types/document';

export const documentSchema = new Schema<IDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    
    // Relations
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    whatsappMessageId: {
      type: String,
    },
    
    // File info
    filename: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    documentType: {
      type: String,
      enum: ['presupuesto', 'cotizacion', 'remito', 'factura', 'contrato', 'imagen', 'otro'],
      default: 'otro',
    },
    
    // Cloudinary
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    cloudinaryUrl: {
      type: String,
    },
    secureUrl: {
      type: String,
      required: true,
    },
    
    // File metadata
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    format: {
      type: String,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    
    // Source tracking
    source: {
      type: String,
      enum: ['crm', 'whatsapp'],
      default: 'crm',
    },
    
    // WhatsApp specific
    mediaId: {
      type: String,
    },
    
    // Timestamps
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
documentSchema.index({ tenantId: 1, clientId: 1 });
documentSchema.index({ tenantId: 1, leadId: 1 });
documentSchema.index({ tenantId: 1, conversationId: 1 });
documentSchema.index({ createdAt: -1 });

export interface IDocumentModel extends IDocument, MongoDocument {}

export const DocumentModel = mongoose.models.Document || 
  mongoose.model<IDocumentModel>('Document', documentSchema);

export default DocumentModel;