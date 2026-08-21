export type RemitoStatus = 'draft' | 'sent' | 'delivered' | 'confirmed';

export interface IRemito {
  _id?: string;
  tenantId: string;
  leadId?: string;
  clientId?: string;
  sourceDocumentId?: string;
  number: string;
  status: RemitoStatus;
  title: string;
  description?: string;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
