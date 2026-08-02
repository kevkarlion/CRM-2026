import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
export type WorkOrderCategory = 'installation' | 'maintenance' | 'repair' | 'inspection' | 'warranty' | 'emergency';
export type WorkOrderStatus = 'draft' | 'scheduled' | 'confirmed' | 'assigned' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'closed';

export interface IClientSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  customerType?: string;
  status?: string;
}

export interface ILocationDetails {
  floor?: string;
  apartment?: string;
  tower?: string;
  office?: string;
  neighborhood?: string;
  block?: string;
  lot?: string;
  reference?: string;
  observations?: string;
}

export interface ILocationSnapshot {
  name?: string;
  address: string; // Obligatorio
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  // Google Maps coordinates
  latitude?: number;
  longitude?: number;
  placeId?: string;
  // Additional location details
  details?: ILocationDetails | null;
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

// Campos adicionales para el técnico
export interface ITechnicianNotes {
  materials?: string;       // Materiales que necesita
  tools?: string;           // Herramientas requeridas
  additionalNotes?: string; // Notas adicionales
}

export type WorkOrderSource = 'manual' | 'maintenance_contract';

export interface IWorkOrder extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  locationId: Types.ObjectId;
  leadId?: Types.ObjectId | null;
  equipmentId: Types.ObjectId | null;
  quoteId?: Types.ObjectId;
  clientSnapshot: IClientSnapshot;
  locationSnapshot: ILocationSnapshot;
  equipmentSnapshot: IEquipmentSnapshot | null;
  contractSnapshot?: IContractSnapshot;
  technicianNotes?: ITechnicianNotes;
  source: WorkOrderSource;
  workOrderNumber: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  status: WorkOrderStatus;
  scheduledDate?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  estimatedDuration?: number;
  responseDueAt?: Date;
  resolutionDueAt?: Date;
  assignedTechnicians: Types.ObjectId[];
  // Tracking de ejecución del trabajo
  startedAt?: Date | null;
  startedBy?: Types.ObjectId | null;
  finishedAt?: Date | null;
  completedAt?: Date | null;
  duration?: number | null;
  // Referencia al WorkReport
  workReportId?: Types.ObjectId | null;
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
