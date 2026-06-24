import { Document, Types } from 'mongoose';

export type FrequencyUnit = 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'days';

export interface IMaintenancePlan extends Document {
  tenantId: Types.ObjectId;
  contractId: Types.ObjectId;
  name: string;
  interval: number;
  unit: FrequencyUnit;
  description?: string;
  checklistTemplate?: string[];
  active: boolean;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface CreateMaintenancePlanInput {
  name: string;
  interval: number;
  unit: FrequencyUnit;
  description?: string;
  checklistTemplate?: string[];
}

export interface UpdateMaintenancePlanInput {
  name?: string;
  interval?: number;
  unit?: FrequencyUnit;
  description?: string;
  checklistTemplate?: string[];
  active?: boolean;
}
