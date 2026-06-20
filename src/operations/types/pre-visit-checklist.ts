import { Document, Types } from 'mongoose';

export interface IPreVisitChecklist extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  workOrderReviewed: boolean;
  toolsPrepared: boolean;
  partsAvailable: boolean;
  routeConfirmed: boolean;
  vehicleAssigned: boolean;
  safetyEquipmentChecked: boolean;
  notes?: string;
  completedBy: Types.ObjectId;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePreVisitChecklistInput = Omit<
  IPreVisitChecklist,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'completedBy' | 'completedAt'
>;
