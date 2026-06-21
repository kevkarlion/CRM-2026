import { Types } from 'mongoose';
import PipelineModel from '../models/pipeline';
import { DEFAULT_STAGES } from '../pipelines/default-pipeline';
import type { IPipeline, IPipelineStage, CreatePipelineInput } from '../types/pipeline';
import { logActivity } from '../../audit/activity-logger';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PipelineService {
  async createPipeline(
    data: CreatePipelineInput,
    userId: string,
    tenantId: string,
  ): Promise<IPipeline> {
    const existingCount = await PipelineModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).exec();

    const stages = (data.stages || []).map((s, i) => ({
      name: s.name,
      position: s.position ?? i,
      probability: s.probability,
      isActive: s.isActive !== undefined ? s.isActive : true,
    }));

    const pipeline = await PipelineModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: data.name,
      stages,
      isDefault: existingCount === 0,
      createdBy: userId,
      updatedBy: userId,
    });

    await logActivity({
      tenantId,
      entityType: 'pipeline',
      entityId: String(pipeline._id),
      action: 'created',
      actorId: userId,
      metadata: { name: pipeline.name, isDefault: pipeline.isDefault },
    });

    return pipeline.toObject() as unknown as IPipeline;
  }

  async getPipelines(tenantId: string): Promise<IPipeline[]> {
    const pipelines = await PipelineModel.find({
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .lean()
      .exec() as unknown as IPipeline[];

    if (pipelines.length === 0) {
      const seeded = await seedDefaultPipeline(tenantId);
      return [seeded];
    }

    return pipelines;
  }

  async getDefaultPipeline(tenantId: string): Promise<IPipeline | null> {
    let pipeline = await PipelineModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isDefault: true,
      deletedAt: null,
    })
      .lean()
      .exec() as unknown as IPipeline | null;

    if (!pipeline) {
      pipeline = await seedDefaultPipeline(tenantId);
    }

    return pipeline;
  }

  async updatePipeline(
    pipelineId: string,
    data: Partial<CreatePipelineInput>,
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const setData: Record<string, unknown> = { updatedBy: userId };
    if (data.name !== undefined) setData.name = data.name;
    if (data.stages !== undefined) setData.stages = data.stages;

    const pipeline = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: setData },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (pipeline) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'updated',
        actorId: userId,
        changes: { after: setData as Record<string, unknown> },
      });
    }

    return pipeline;
  }

  async addStage(
    pipelineId: string,
    stage: { name: string; probability: number },
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const pipeline = await PipelineModel.findOne({
      _id: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .lean()
      .exec() as unknown as IPipeline | null;

    if (!pipeline) return null;

    const maxPosition = pipeline.stages.reduce(
      (max, s) => Math.max(max, s.position), -1
    );

    const updated = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $push: {
          stages: {
            name: stage.name,
            probability: stage.probability,
            position: maxPosition + 1,
            isActive: true,
          },
        },
        $set: { updatedBy: userId },
      },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'updated',
        actorId: userId,
        metadata: { change: 'stageAdded', stageName: stage.name },
      });
    }

    return updated;
  }

  async updateStage(
    pipelineId: string,
    stageIndex: number,
    data: Partial<IPipelineStage>,
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const setFields: Record<string, unknown> = { updatedBy: userId };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setFields[`stages.${stageIndex}.${key}`] = value;
      }
    }

    const updated = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: setFields },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'updated',
        actorId: userId,
        metadata: { change: 'stageUpdated', stageIndex, updates: data as Record<string, unknown> },
      });
    }

    return updated;
  }

  async deactivateStage(
    pipelineId: string,
    stageIndex: number,
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const updated = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $set: {
          [`stages.${stageIndex}.isActive`]: false,
          updatedBy: userId,
        },
      },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'updated',
        actorId: userId,
        metadata: { change: 'stageDeactivated', stageIndex },
      });
    }

    return updated;
  }

  async reorderStages(
    pipelineId: string,
    stageOrder: { stageId: string; position: number }[],
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const pipeline = await PipelineModel.findOne({
      _id: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .lean()
      .exec() as unknown as IPipeline | null;

    if (!pipeline) return null;

    const stageMap = new Map<string, IPipelineStage>();
    for (const stage of pipeline.stages) {
      const stageWithId = stage as IPipelineStage & { _id?: unknown };
      if (stageWithId._id) {
        stageMap.set(String(stageWithId._id), { ...stage });
      }
    }

    const reorderedStages = stageOrder.map((item) => {
      const stage = stageMap.get(item.stageId);
      if (!stage) {
        throw new Error(`Stage with ID ${item.stageId} not found in pipeline`);
      }
      return { ...stage, position: item.position };
    });

    const updated = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { stages: reorderedStages, updatedBy: userId } },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'updated',
        actorId: userId,
        metadata: { change: 'stagesReordered' },
      });
    }

    return updated;
  }

  async deletePipeline(
    pipelineId: string,
    userId: string,
    tenantId: string,
  ): Promise<IPipeline | null> {
    const pipeline = await PipelineModel.findOne({
      _id: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .lean()
      .exec() as unknown as IPipeline | null;

    if (!pipeline) return null;

    if (pipeline.isDefault) {
      throw new ValidationError('Cannot delete the default pipeline');
    }

    const updated = await PipelineModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(pipelineId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { deletedAt: new Date(), deletedBy: userId } },
      { new: true },
    )
      .lean()
      .exec() as unknown as IPipeline | null;

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'pipeline',
        entityId: pipelineId,
        action: 'deleted',
        actorId: userId,
      });
    }

    return updated;
  }
}

export async function seedDefaultPipeline(
  tenantId: string,
  userId?: string,
): Promise<IPipeline> {
  const existing = await PipelineModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    isDefault: true,
    deletedAt: null,
  }).exec();

  if (existing) {
    return existing.toObject() as unknown as IPipeline;
  }

  const pipeline = await PipelineModel.create({
    tenantId: new Types.ObjectId(tenantId),
    name: 'Pipeline Default',
    isDefault: true,
    stages: DEFAULT_STAGES.map(s => ({
      name: s.name,
      position: s.position,
      probability: s.probability,
      isActive: s.isActive,
    })),
    createdBy: userId || 'system',
    updatedBy: userId || 'system',
  });

  return pipeline.toObject() as unknown as IPipeline;
}
