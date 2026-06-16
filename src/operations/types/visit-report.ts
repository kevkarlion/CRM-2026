import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export interface IVisitReport extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicianId: Types.ObjectId;
  arrivalTime: Date;
  departureTime: Date;
  workPerformed: string;
  observations?: string;
  recommendations?: string;
  customerSignature?: string;
  customerName?: string;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateVisitReportInput = Omit<
  IVisitReport,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'customerSignature' | 'customerName' | 'signedAt'
>;

export type UpdateVisitReportInput = Partial<
  Omit<CreateVisitReportInput, 'tenantId' | 'workOrderId' | 'technicianId'>
>;
