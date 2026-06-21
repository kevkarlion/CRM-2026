import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockPipelineCreate } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = { lean: vi.fn(), exec };
  chain.lean.mockReturnValue(chain);
  return {
    mockQueryChain: chain,
    mockPipelineCreate: vi.fn(),
  };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) {}
    toString() { return 'mock-id'; }
  }
  return {
    Types: { ObjectId: MockObjectId as any },
    Schema: class {
      static Types = { ObjectId: MockObjectId };
      index(...args: any[]) { return this; }
    },
    model: vi.fn(),
    Document: class {},
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
      model: vi.fn(),
    },
  };
});

vi.mock('../../src/leads/models/pipeline', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    find: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    countDocuments: vi.fn().mockReturnValue(mockQueryChain),
    create: mockPipelineCreate,
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { PipelineService, ValidationError } from '../../src/leads/services/pipeline.service';
import type { IPipeline } from '../../src/leads/types/pipeline';

function makePipeline(overrides: Record<string, unknown> = {}): any {
  return {
    _id: 'pipeline1',
    tenantId: 'tenant1',
    name: 'Pipeline Test',
    isDefault: false,
    stages: [
      { _id: 'stage1-id', name: 'Nuevo', position: 0, probability: 10, isActive: true },
      { _id: 'stage2-id', name: 'Ganado', position: 1, probability: 90, isActive: true },
    ],
    createdBy: 'user1',
    updatedBy: 'user1',
    deletedAt: null,
    deletedBy: null,
    toObject() { return { ...this }; },
    ...overrides,
  };
}

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    service = new PipelineService();
    vi.clearAllMocks();
  });

  describe('createPipeline', () => {
    it('creates a pipeline successfully', async () => {
      const pipelineData = makePipeline();
      mockPipelineCreate.mockResolvedValue(pipelineData);
      mockQueryChain.exec.mockResolvedValueOnce(0);

      const result = await service.createPipeline(
        { name: 'Pipeline Test', stages: [{ name: 'Nuevo', position: 0, probability: 10, isActive: true }] },
        'user1',
        'tenant1',
      );

      expect(result.name).toBe('Pipeline Test');
    });

    it('sets isDefault to true when it is the first pipeline', async () => {
      const pipelineData = makePipeline({ isDefault: true });
      mockPipelineCreate.mockResolvedValue(pipelineData);
      mockQueryChain.exec.mockResolvedValueOnce(0);

      await service.createPipeline(
        { name: 'First Pipeline', stages: [] },
        'user1',
        'tenant1',
      );

      expect(mockPipelineCreate).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
    });

    it('sets isDefault to false when pipelines already exist', async () => {
      const pipelineData = makePipeline({ isDefault: false });
      mockPipelineCreate.mockResolvedValue(pipelineData);
      mockQueryChain.exec.mockResolvedValueOnce(2);

      await service.createPipeline(
        { name: 'Second Pipeline', stages: [] },
        'user1',
        'tenant1',
      );

      expect(mockPipelineCreate).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });
  });

  describe('getPipelines', () => {
    it('returns list of pipelines', async () => {
      const pipelines = [makePipeline(), makePipeline({ _id: 'pipeline2' })];
      mockQueryChain.exec.mockResolvedValue(pipelines);

      const result = await service.getPipelines('tenant1');

      expect(result).toHaveLength(2);
    });

    it('auto-seeds default pipeline when empty', async () => {
      const seededPipeline = makePipeline({ isDefault: true, name: 'Pipeline Default' });
      mockQueryChain.exec
        .mockResolvedValueOnce([])    // find → empty
        .mockResolvedValueOnce(null); // findOne in seedDefaultPipeline → no existing
      mockPipelineCreate.mockResolvedValue(seededPipeline);

      const result = await service.getPipelines('tenant1');

      expect(result).toHaveLength(1);
      expect(mockPipelineCreate).toHaveBeenCalled();
    });
  });

  describe('getDefaultPipeline', () => {
    it('returns default pipeline when it exists', async () => {
      const defaultPipeline = makePipeline({ isDefault: true });
      mockQueryChain.exec.mockResolvedValue(defaultPipeline);

      const result = await service.getDefaultPipeline('tenant1');

      expect(result).toBeDefined();
      expect(result!.isDefault).toBe(true);
    });

    it('lazy seeds default pipeline when not found', async () => {
      const seededPipeline = makePipeline({ isDefault: true, name: 'Pipeline Default' });
      mockQueryChain.exec
        .mockResolvedValueOnce(null)   // findOne → null
        .mockResolvedValueOnce(null);  // seedDefaultPipeline findOne → null
      mockPipelineCreate.mockResolvedValue(seededPipeline);

      const result = await service.getDefaultPipeline('tenant1');

      expect(result).toBeDefined();
      expect(mockPipelineCreate).toHaveBeenCalled();
    });
  });

  describe('updatePipeline', () => {
    it('updates pipeline name', async () => {
      const updated = makePipeline({ name: 'Renamed' });
      mockQueryChain.exec.mockResolvedValue(updated);

      const result = await service.updatePipeline('pipeline1', { name: 'Renamed' }, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Renamed');
    });

    it('returns null when pipeline not found', async () => {
      mockQueryChain.exec.mockResolvedValue(null);

      const result = await service.updatePipeline('nonexistent', { name: 'Test' }, 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });

  describe('addStage', () => {
    it('adds a stage to a pipeline', async () => {
      const existingPipeline = makePipeline();
      const updatedPipeline = makePipeline({
        stages: [
          ...existingPipeline.stages,
          { _id: 'stage3-id', name: 'Demo', position: 2, probability: 50, isActive: true },
        ],
      });
      mockQueryChain.exec
        .mockResolvedValueOnce(existingPipeline)
        .mockResolvedValueOnce(updatedPipeline);

      const result = await service.addStage('pipeline1', { name: 'Demo', probability: 50 }, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.stages).toHaveLength(3);
    });

    it('returns null when pipeline not found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      const result = await service.addStage('nonexistent', { name: 'Demo', probability: 50 }, 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });

  describe('updateStage', () => {
    it('updates a stage by index', async () => {
      const updated = makePipeline({
        stages: [
          { _id: 'stage1-id', name: 'Nuevo Renamed', position: 0, probability: 15, isActive: true },
          { _id: 'stage2-id', name: 'Ganado', position: 1, probability: 90, isActive: true },
        ],
      });
      mockQueryChain.exec.mockResolvedValue(updated);

      const result = await service.updateStage('pipeline1', 0, { name: 'Nuevo Renamed', probability: 15 }, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.stages[0].name).toBe('Nuevo Renamed');
      expect(result!.stages[0].probability).toBe(15);
    });
  });

  describe('deactivateStage', () => {
    it('deactivates a stage by index', async () => {
      const updated = makePipeline({
        stages: [
          { _id: 'stage1-id', name: 'Nuevo', position: 0, probability: 10, isActive: false },
          { _id: 'stage2-id', name: 'Ganado', position: 1, probability: 90, isActive: true },
        ],
      });
      mockQueryChain.exec.mockResolvedValue(updated);

      const result = await service.deactivateStage('pipeline1', 0, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.stages[0].isActive).toBe(false);
    });
  });

  describe('reorderStages', () => {
    it('reorders stages by given positions', async () => {
      const existingPipeline = makePipeline();
      const reorderedPipeline = makePipeline({
        stages: [
          { _id: 'stage1-id', name: 'Nuevo', position: 1, probability: 10, isActive: true },
          { _id: 'stage2-id', name: 'Ganado', position: 0, probability: 90, isActive: true },
        ],
      });
      mockQueryChain.exec
        .mockResolvedValueOnce(existingPipeline)
        .mockResolvedValueOnce(reorderedPipeline);

      const stageOrder = [
        { stageId: 'stage1-id', position: 1 },
        { stageId: 'stage2-id', position: 0 },
      ];

      const result = await service.reorderStages('pipeline1', stageOrder, 'user1', 'tenant1');

      expect(result).toBeDefined();
    });

    it('returns null when pipeline not found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      const result = await service.reorderStages('nonexistent', [], 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });

  describe('deletePipeline', () => {
    it('deletes a non-default pipeline', async () => {
      const pipeline = makePipeline({ isDefault: false });
      const deleted = makePipeline({ isDefault: false, deletedAt: new Date() });
      mockQueryChain.exec
        .mockResolvedValueOnce(pipeline)
        .mockResolvedValueOnce(deleted);

      const result = await service.deletePipeline('pipeline1', 'user1', 'tenant1');

      expect(result).toBeDefined();
    });

    it('rejects deleting default pipeline', async () => {
      const defaultPipeline = makePipeline({ isDefault: true });
      mockQueryChain.exec.mockResolvedValueOnce(defaultPipeline);

      await expect(
        service.deletePipeline('pipeline1', 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });

    it('returns null when pipeline not found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      const result = await service.deletePipeline('nonexistent', 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });
});
