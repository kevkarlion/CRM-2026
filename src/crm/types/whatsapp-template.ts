import { Document, Types } from 'mongoose';

export type WhatsAppTemplateCategory = 'TRANSACTIONAL' | 'MARKETING' | 'AUTHENTICATION';

export interface IWhatsAppTemplateVariable {
  index: number; // 1-based position in template
  field: string; // Client field path (e.g., "fullName", "phone")
  defaultValue?: string;
}

export interface IWhatsAppTemplate extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string; // Meta template name (e.g., "reapertura_gestion_v1")
  language: string; // e.g., "es"
  category: WhatsAppTemplateCategory;
  content?: string; // Full template text from Meta (with {{1}}, {{2}}, etc.)
  variables: IWhatsAppTemplateVariable[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWhatsAppTemplateInput {
  tenantId: Types.ObjectId;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  content?: string;
  variables?: IWhatsAppTemplateVariable[];
  isActive?: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface UpdateWhatsAppTemplateInput {
  name?: string;
  language?: string;
  category?: WhatsAppTemplateCategory;
  content?: string;
  variables?: IWhatsAppTemplateVariable[];
  isActive?: boolean;
  updatedBy: Types.ObjectId;
}

export interface SendTemplateMessageParams {
  tenantId: string;
  to: string; // Normalized phone (E.164)
  templateName: string;
  language?: string;
  variables: Record<number, string>; // { 1: "Juan", 2: "presupuesto" }
}

export interface SendTemplateResult {
  message: import('./whatsapp-message').IWhatsAppMessage;
  metaResponse: unknown;
}
