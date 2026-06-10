import { Document, Types } from 'mongoose';

export interface IAttachment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageProvider: string;
  storagePath: string;
  storageMetadata?: Record<string, unknown>;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export type CreateAttachmentInput = Omit<
  IAttachment,
  keyof Document | '_id' | 'createdAt'
>;
