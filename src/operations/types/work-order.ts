import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
export type WorkOrderCategory = 'installation' | 'maintenance' | 'repair' | 'inspection' | 'warranty' | 'emergency';
export type WorkOrderStatus = 'draft' | 'scheduled' | 'confirmed' | 'assigned' | 'en_route' | 'on_site' | 'paused' | 'completed' | 'cancelled' | 'closed';

export interface IClientSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  customerType?: string;
  status?: string;
}

export interface ILocationSnapshot {
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
}

export interface IEquipmentSnapshot {
  equipmentType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  status?: string;
}

export interface IContractSnapshot {
  contractId: Types.ObjectId;
  contractName: string;
  maintenanceScheduleId: Types.ObjectId;
  planName: string;
  equipmentIds: Types.ObjectId[];
}

export type WorkOrderSource = 'manual' | 'maintenance_contract';

export interface IWorkOrder extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId;
  equipmentId: Types.ObjectId | null;
  quoteId?: Types.ObjectId;
  clientSnapshot: IClientSnapshot;
  locationSnapshot: ILocationSnapshot;
  equipmentSnapshot: IEquipmentSnapshot | null;
  contractSnapshot?: IContractSnapshot;
  source: WorkOrderSource;
  workOrderNumber: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  status: WorkOrderStatus;
  scheduledDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  estimatedDuration?: number;
  responseDueAt?: Date;
  resolutionDueAt?: Date;
  assignedTechnicians: Types.ObjectId[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkOrderInput = Omit<
  IWorkOrder,
  keyof Document | '_id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt' | 'workOrderNumber' | 'assignedTechnicians' | 'status' | 'version'
>;

export type UpdateWorkOrderInput = Partial<
  Omit<CreateWorkOrderInput, 'tenantId' | 'clientId' | 'clientSnapshot' | 'locationSnapshot' | 'equipmentSnapshot' | 'workOrderNumber'>
>;
