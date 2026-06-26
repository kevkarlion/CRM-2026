import { Schema } from 'mongoose';
import { IPipeline, IPipelineStage } from '../types/pipeline';

const pipelineStageSchema = new Schema<IPipelineStage>(
  {
    name: { type: String, required: true },
    position: { type: Number, required: true },
    probability: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    mapsToStatus: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost', 'disqualified'],
      required: false,
      default: undefined,
    },
  },
  { _id: true }
);

export const pipelineSchema = new Schema<IPipeline>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    stages: { type: [pipelineStageSchema], default: [] },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

pipelineSchema.index({ tenantId: 1, isDefault: 1 });
pipelineSchema.index({ tenantId: 1, name: 1 }, { unique: true });
