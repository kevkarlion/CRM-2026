import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockLeadCreate, mockLeadFind, stateMachineMock } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    populate: vi.fn(),
    limit: vi.fn(),
    exec,
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  const mockLeadFind = vi.fn().mockReturnValue(chain);

  return {
    mockQueryChain: chain,
    mockLeadCreate: vi.fn(),
    mockLeadFind,
    stateMachineMock: {
      TERMINAL_STATUSES: ['won', 'lost', 'disqualified'],
    },
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

vi.mock('../../src/leads/models/lead', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    find: mockLeadFind,
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    countDocuments: vi.fn().mockReturnValue(mockQueryChain),
    create: mockLeadCreate,
  },
}));

vi.mock('../../src/leads/models/pipeline', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
  },
}));

vi.mock('../../src/core/models/user', () => ({
  default: {
    find: vi.fn().mockReturnValue(mockQueryChain),
  },
}));

vi.mock('../../src/leads/helpers/lead-state-machine', () => ({
  get TERMINAL_STATUSES() { return stateMachineMock.TERMINAL_STATUSES; },
  VALID_TRANSITIONS: {
    new: ['contacted', 'lost'],
    contacted: ['qualified', 'lost'],
    qualified: ['won', 'lost'],
    won: [],
    lost: [],
    disqualified: [],
  },
  canTransition: vi.fn(),
  validateTransition: vi.fn(),
  TransitionError: class extends Error {
    constructor(from: string, to: string, reason: string) {
      super(`Cannot transition from ${from} to ${to}: ${reason}`);
      this.name = 'TransitionError';
    }
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { LeadService, ValidationError } from '../../src/leads/services/lead.service';

function makePipeline(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'pipeline1',
    tenantId: 'tenant1',
    name: 'Default Pipeline',
    isDefault: true,
    stages: [
      { _id: 'stage1', name: 'Nuevo contacto', position: 0, probability: 10, isActive: true, mapsToStatus: 'new' as const },
      { _id: 'stage2', name: 'Contactado', position: 1, probability: 25, isActive: true, mapsToStatus: 'contacted' as const },
      { _id: 'stage3', name: 'Visita técnica', position: 2, probability: 50, isActive: true, mapsToStatus: 'qualified' as const },
      { _id: 'stage4', name: 'Presupuesto', position: 3, probability: 75, isActive: true, mapsToStatus: 'qualified' as const },
      { _id: 'stage5', name: 'Ganado', position: 4, probability: 100, isActive: true, mapsToStatus: 'won' as const },
    ],
    ...overrides,
  };
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead1',
    tenantId: 'tenant1',
    name: 'Juan Pérez',
    email: 'juan@test.com',
    phone: '+5491112345678',
    source: 'whatsapp',
    status: 'new',
    assignedTo: null,
    companyName: 'ACME',
    notes: 'interesado',
    convertedToClient: null,
    convertedAt: null,
    createdBy: 'user1',
    updatedBy: 'user1',
    deletedAt: null,
    deletedBy: null,
    estimatedValue: 15000,
    ...overrides,
  };
}

describe('LeadService — getLeadsGroupedByStage', () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService();
    vi.clearAllMocks();
    mockQueryChain.exec.mockReset();
    stateMachineMock.TERMINAL_STATUSES = ['won', 'lost', 'disqualified'];
  });

  it('returns leads grouped by stage correctly', async () => {
    const pipeline = makePipeline();
    const leads = [
      makeLead({ _id: 'lead1', status: 'new', name: 'Lead New' }),
      makeLead({ _id: 'lead2', status: 'contacted', name: 'Lead Contacted' }),
      makeLead({ _id: 'lead3', status: 'qualified', name: 'Lead Qualified' }),
    ];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage('pipeline1', 'tenant1', 'user1', 'comercial', {});

    expect(result.pipeline._id).toBe('pipeline1');
    expect(result.groups['Nuevo contacto'].leads.map((l: any) => l._id)).toEqual(['lead1']);
    expect(result.groups['Contactado'].leads.map((l: any) => l._id)).toEqual(['lead2']);
    expect(result.groups['Visita técnica'].leads.map((l: any) => l._id)).toEqual(['lead3']);
    expect(result.groups['Presupuesto'].leads).toHaveLength(0);
    expect(result.groups['Ganado'].leads).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
    expect(result.truncated).toEqual({});
  });

  it('handles mapsToStatus collision — lead goes to first stage by position', async () => {
    const pipeline = makePipeline();
    const leads = [
      makeLead({ _id: 'lead4', status: 'qualified', name: 'Dual Qualified' }),
    ];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage('pipeline1', 'tenant1', 'user1', 'comercial', {});

    // Visita técnica (position 2) is first active stage mapping to 'qualified'
    expect(result.groups['Visita técnica'].leads).toHaveLength(1);
    expect(result.groups['Visita técnica'].leads[0]._id).toBe('lead4');
    expect(result.groups['Presupuesto'].leads).toHaveLength(0);
  });

  it('returns unmatched leads when status has no matching stage', async () => {
    stateMachineMock.TERMINAL_STATUSES = [];
    const pipeline = makePipeline();
    const leads = [
      makeLead({ _id: 'lead5', status: 'lost', name: 'Lost Lead' }),
      makeLead({ _id: 'lead6', status: 'disqualified', name: 'Disqualified Lead' }),
    ];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage('pipeline1', 'tenant1', 'user1', 'comercial', {});

    expect(result.unmatched).toHaveLength(2);
    expect(result.unmatched[0]._id).toBe('lead5');
    expect(result.unmatched[1]._id).toBe('lead6');
  });

  it('throws ValidationError when pipeline is not found', async () => {
    mockQueryChain.exec.mockResolvedValueOnce(null);

    await expect(
      service.getLeadsGroupedByStage('nonexistent', 'tenant1', 'user1', 'comercial', {}),
    ).rejects.toThrow(ValidationError);
  });

  it('filters by assignedTo', async () => {
    const pipeline = makePipeline();
    const leads = [makeLead({ _id: 'lead1', status: 'new' })];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'comercial',
      { assignedTo: 'user2' },
    );

    expect(mockLeadFind).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: expect.any(Object) }),
    );
    expect(result.groups['Nuevo contacto'].leads).toHaveLength(1);
  });

  it('filters by search (matches on name or companyName)', async () => {
    const pipeline = makePipeline();
    const leads = [makeLead({ _id: 'lead1', status: 'new', name: 'Acme Corp' })];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'comercial',
      { search: 'Acme' },
    );

    expect(mockLeadFind).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ name: expect.objectContaining({ $regex: 'Acme' }) }),
        ]),
      }),
    );
    expect(result.groups['Nuevo contacto'].leads).toHaveLength(1);
  });

  it('filters by date range (createdAtGte / createdAtLte)', async () => {
    const pipeline = makePipeline();
    const leads = [makeLead({ _id: 'lead1', status: 'new' })];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'comercial',
      { createdAtGte: '2026-01-01', createdAtLte: '2026-06-30' },
    );

    expect(mockLeadFind).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }),
      }),
    );
    expect(result.groups['Nuevo contacto'].leads).toHaveLength(1);
  });

  it('enforces role scope — comercial sees own leads only', async () => {
    const pipeline = makePipeline();
    const leads = [makeLead({ _id: 'lead1', status: 'new', assignedTo: 'user1' })];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'comercial', {},
    );

    // applyRoleScope for 'comercial' adds assignedTo: userId
    expect(mockLeadFind).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: expect.any(Object) }),
    );
  });

  it('enforces role scope — admin sees all leads', async () => {
    const pipeline = makePipeline();
    const leads = [
      makeLead({ _id: 'lead1', status: 'new', assignedTo: 'user1' }),
      makeLead({ _id: 'lead2', status: 'contacted', assignedTo: 'user2' }),
    ];

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'Administrator', {},
    );

    // Admin has no assignedTo filter — finds all leads in the tenant
    expect(result.groups['Nuevo contacto'].leads).toHaveLength(1);
    expect(result.groups['Contactado'].leads).toHaveLength(1);
    // LeadModel.find should NOT have assignedTo in its filter
    const findCall = mockLeadFind.mock.calls[0][0];
    expect(findCall.assignedTo).toBeUndefined();
  });

  it('respects 500 lead limit per group with truncated flag', async () => {
    const pipeline = makePipeline();
    const leads501 = Array.from({ length: 501 }, (_, i) =>
      makeLead({ _id: `lead${i}`, status: 'new', name: `Lead ${i}` }),
    );

    mockQueryChain.exec
      .mockResolvedValueOnce(pipeline)
      .mockResolvedValueOnce(leads501);

    const result = await service.getLeadsGroupedByStage(
      'pipeline1', 'tenant1', 'user1', 'comercial', {},
    );

    expect(result.groups['Nuevo contacto'].leads).toHaveLength(500);
    expect(result.truncated['Nuevo contacto']).toBe(true);
  });
});
