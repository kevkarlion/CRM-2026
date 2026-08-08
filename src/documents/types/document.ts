import { Types } from 'mongoose';

export type DocumentType = 
  | 'presupuesto'
  | 'cotizacion'
  | 'remito'
  | 'factura'
  | 'contrato'
  | 'imagen'
  | 'otro';

export type DocumentSource = 
  | 'crm'
  | 'whatsapp';

export interface IDocument extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  
  // Relations
  clientId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  whatsappMessageId?: string;
  
  // File info
  filename: string;
  title: string;
  description?: string;
  documentType: DocumentType;
  
  // Cloudinary
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  secureUrl: string;
  downloadUrl?: string;
  
  // File metadata
  mimeType: string;
  fileSize: number;
  format?: string;
  width?: number;
  height?: number;
  
  // Source tracking
  source: DocumentSource;
  
  // WhatsApp specific
  mediaId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Types.ObjectId;
}

export interface CreateDocumentInput {
  tenantId: string;
  
  // Relations
  clientId?: string;
  leadId?: string;
  conversationId?: string;
  whatsappMessageId?: string;
  
  // File info
  filename: string;
  title: string;
  description?: string;
  documentType: DocumentType;
  
  // Cloudinary result
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  secureUrl: string;
  downloadUrl?: string;
  
  // File metadata
  mimeType: string;
  fileSize: number;
  format?: string;
  width?: number;
  height?: number;
  
  // Source
  source: DocumentSource;
  mediaId?: string;
  
  createdBy?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  documentType?: DocumentType;
}

// Helper for labels
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  presupuesto: 'Presupuesto',
  cotizacion: 'Cotización',
  remito: 'Remito',
  factura: 'Factura',
  contrato: 'Contrato',
  imagen: 'Imagen',
  otro: 'Otro',
};

export const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value: value as DocumentType,
  label,
}));