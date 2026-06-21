import { Document, Types } from 'mongoose';

export interface IPipelineStage {
  name: string;
  position: number;
  probability: number;
  isActive: boolean;
}

export interface IPipeline extends Document {
  tenantId: Types.ObjectId;
  name: string;
  isDefault: boolean;
  stages: IPipelineStage[];
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface CreatePipelineInput {
  name: string;
  stages: IPipelineStage[];
}

export interface UpdatePipelineInput {
  name?: string;
  stages?: IPipelineStage[];
}

export interface AddStageInput {
  name: string;
  position: number;
  probability: number;
}

export interface UpdateStageInput {
  name?: string;
  position?: number;
  probability?: number;
  isActive?: boolean;
}
