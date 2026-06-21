import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockLeadCreate, mockActivityExists, mockFindDuplicates, mockAssign, mockUnassign, mockCursorPage } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    populate: vi.fn(),
    exec,
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  return {
    mockQueryChain: chain,
    mockLeadCreate: vi.fn(),
    mockActivityExists: vi.fn(),
    mockFindDuplicates: vi.fn(),
    mockAssign: vi.fn(),
    mockUnassign: vi.fn(),
    mockCursorPage: vi.fn(),
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
    find: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    countDocuments: vi.fn().mockReturnValue(mockQueryChain),
    create: mockLeadCreate,
  },
}));

vi.mock('../../src/crm/models/activity', () => ({
  default: {
    exists: mockActivityExists,
  },
}));

vi.mock('../../src/leads/helpers/duplicate-detection', () => ({
  findDuplicates: mockFindDuplicates,
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../src/leads/services/lead-assignment.service', () => ({
  LeadAssignmentService: vi.fn().mockImplementation(() => ({
    assign: mockAssign,
    unassign: mockUnassign,
    reassign: vi.fn(),
    getAssignmentHistory: vi.fn(),
    getActiveAssignments: vi.fn(),
  })),
}));

vi.mock('../../src/crm/helpers/cursor-pagination', () => ({
  cursorPage: mockCursorPage,
}));

import { LeadService, ConflictError, ValidationError } from '../../src/leads/services/lead.service';

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
    toObject() { return { ...this }; },
    ...overrides,
  };
}

describe('LeadService', () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService();
    vi.clearAllMocks();
  });

  describe('createLead', () => {
    it('creates a lead successfully', async () => {
      const leadData = makeLead();
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', phone: '+5491112345678', source: 'whatsapp' },
        'user1',
        'tenant1',
      );

      expect(result.lead).toBeDefined();
      expect(result.warnings).toBeUndefined();
    });

    it('calls assignmentService.assign when assignedTo is provided', async () => {
      const leadData = makeLead({ assignedTo: 'user2' });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockAssign.mockResolvedValue({});

      await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', assignedTo: 'user2' },
        'user1',
        'tenant1',
      );

      expect(mockAssign).toHaveBeenCalledWith('lead1', 'user2', 'user1', 'tenant1');
    });

    it('returns warnings when duplicates are found', async () => {
      const leadData = makeLead();
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([
        { _id: 'dup1', email: 'juan@test.com', phone: 'other', companyName: 'Other' },
      ]);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp' },
        'user1',
        'tenant1',
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].matchedField).toBe('email');
    });
  });

  describe('getLead', () => {
    it('returns a lead when found', async () => {
      const leadData = makeLead();
      mockQueryChain.exec.mockResolvedValue(leadData);

      const result = await service.getLead('lead1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!._id).toBe('lead1');
    });

    it('returns null when lead does not exist', async () => {
      mockQueryChain.exec.mockResolvedValue(null);

      const result = await service.getLead('nonexistent', 'tenant1');

      expect(result).toBeNull();
    });
  });

  describe('listLeads', () => {
    it('returns paginated leads with total', async () => {
      const leads = [makeLead({ _id: 'lead1' }), makeLead({ _id: 'lead2' })];
      mockQueryChain.exec.mockResolvedValue(5);
      mockCursorPage.mockResolvedValue({ data: leads, cursor: null });

      const result = await service.listLeads({}, 'tenant1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('applies status filter', async () => {
      mockQueryChain.exec.mockResolvedValue(0);
      mockCursorPage.mockResolvedValue({ data: [], cursor: null });

      await service.listLeads({ status: 'contacted' }, 'tenant1');

      expect(mockCursorPage).toHaveBeenCalled();
    });

    it('applies search filter for name and companyName', async () => {
      mockQueryChain.exec.mockResolvedValue(0);
      mockCursorPage.mockResolvedValue({ data: [], cursor: null });

      await service.listLeads({ search: 'Juan' }, 'tenant1');

      expect(mockCursorPage).toHaveBeenCalled();
    });

    it('applies date range filters', async () => {
      mockQueryChain.exec.mockResolvedValue(0);
      mockCursorPage.mockResolvedValue({ data: [], cursor: null });

      await service.listLeads({ createdAtGte: '2026-01-01', createdAtLte: '2026-12-31' }, 'tenant1');

      expect(mockCursorPage).toHaveBeenCalled();
    });

    it('uses default limit of 20 when not specified', async () => {
      mockQueryChain.exec.mockResolvedValue(0);
      mockCursorPage.mockResolvedValue({ data: [], cursor: null });

      await service.listLeads({}, 'tenant1');

      const cursorOptions = mockCursorPage.mock.calls[0][2];
      expect(cursorOptions.limit).toBe(20);
    });
  });

  describe('updateLead', () => {
    it('updates a lead successfully', async () => {
      const updatedLead = makeLead({ name: 'Juan Updated' });
      mockQueryChain.exec.mockResolvedValue(updatedLead);

      const result = await service.updateLead('lead1', { name: 'Juan Updated' }, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Juan Updated');
    });

    it('throws ValidationError when trying to change status via update', async () => {
      await expect(
        service.updateLead('lead1', { status: 'contacted' as any }, 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });

    it('calls assignmentService.assign when assignedTo is provided in update', async () => {
      const updatedLead = makeLead({ assignedTo: 'user2' });
      mockQueryChain.exec.mockResolvedValue(updatedLead);
      mockAssign.mockResolvedValue({});

      await service.updateLead('lead1', { assignedTo: 'user2' }, 'user1', 'tenant1');

      expect(mockAssign).toHaveBeenCalled();
    });

    it('returns null when lead is not found', async () => {
      mockQueryChain.exec.mockResolvedValue(null);

      const result = await service.updateLead('nonexistent', { name: 'Test' }, 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });

  describe('changeStatus', () => {
    const currentLead = makeLead({ status: 'new' });

    it('performs a valid transition from new to contacted', async () => {
      const updatedLead = makeLead({ status: 'contacted' });
      mockQueryChain.exec
        .mockResolvedValueOnce(currentLead)
        .mockResolvedValueOnce(updatedLead);
      mockActivityExists.mockResolvedValue(true);

      const result = await service.changeStatus('lead1', 'contacted', 'user1', 'tenant1');

      expect(result.status).toBe('contacted');
    });

    it('throws error for invalid transition', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(currentLead);

      await expect(
        service.changeStatus('lead1', 'qualified', 'user1', 'tenant1'),
      ).rejects.toThrow();
    });

    it('throws ConflictError on concurrent modification', async () => {
      mockQueryChain.exec
        .mockResolvedValueOnce(currentLead)
        .mockResolvedValueOnce(null);

      mockActivityExists.mockResolvedValue(true);

      await expect(
        service.changeStatus('lead1', 'contacted', 'user1', 'tenant1'),
      ).rejects.toThrow(ConflictError);
    });

    it('throws when lead not found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      await expect(
        service.changeStatus('nonexistent', 'contacted', 'user1', 'tenant1'),
      ).rejects.toThrow('Lead not found');
    });
  });

  describe('softDelete', () => {
    it('soft deletes a non-won lead', async () => {
      const leadToDelete = makeLead({ status: 'lost' });
      const deletedLead = makeLead({ status: 'lost', deletedAt: new Date(), deletedBy: 'user1' });
      mockQueryChain.exec
        .mockResolvedValueOnce(leadToDelete)
        .mockResolvedValueOnce(deletedLead);

      const result = await service.softDelete('lead1', 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(result!.deletedAt).toBeDefined();
    });

    it('rejects soft delete when lead status is won', async () => {
      const wonLead = makeLead({ status: 'won' });
      mockQueryChain.exec.mockResolvedValueOnce(wonLead);

      await expect(
        service.softDelete('lead1', 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });

    it('returns null when lead is not found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      const result = await service.softDelete('nonexistent', 'user1', 'tenant1');

      expect(result).toBeNull();
    });
  });
});
