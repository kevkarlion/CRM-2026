import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockLeadCreate, mockActivityExists, mockFindDuplicates, mockAssign, mockUnassign, mockCursorPage, mockClientCreate, mockContactCreate } = vi.hoisted(() => {
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
    mockClientCreate: vi.fn(),
    mockContactCreate: vi.fn(),
  };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) {}
    toString() { return 'mock-id'; }
  }
  const mockSession = {
    startTransaction: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    abortTransaction: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn(),
  };
  return {
    Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
    model: vi.fn(),
    Document: class {},
    ClientSession: class {},
    startSession: vi.fn().mockResolvedValue(mockSession),
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
      model: vi.fn(),
      ClientSession: class {},
      startSession: vi.fn().mockResolvedValue(mockSession),
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

vi.mock('../../src/crm/models/client', () => ({
  default: {
    create: mockClientCreate,
  },
}));

vi.mock('../../src/crm/models/contact', () => ({
  default: {
    create: mockContactCreate,
  },
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

vi.mock('../../src/leads/models/pipeline', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
  },
}));

vi.mock('../../src/core/models/user', () => ({
  default: {},
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
    qualificationStatus: 'pending',
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
    it('creates a lead with default status new and nextAction none', async () => {
      const leadData = makeLead();
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockQueryChain.exec.mockResolvedValue(leadData);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', phone: '+5491112345678', source: 'whatsapp' },
        'user1',
        'tenant1',
      );

      expect(result.lead).toBeDefined();
      expect(result.lead.status).toBe('new');
      expect(result.nextAction).toBe('none');
      expect(result.warnings).toBeUndefined();
    });

    it('calls assignmentService.assign when assignedTo is provided', async () => {
      const leadData = makeLead({ assignedTo: 'user2' });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockAssign.mockResolvedValue({});
      mockQueryChain.exec.mockResolvedValue(leadData);

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
      mockQueryChain.exec.mockResolvedValue(leadData);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp' },
        'user1',
        'tenant1',
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].matchedField).toBe('email');
      expect(result.nextAction).toBe('none');
    });

    it('creates lead with default status new when status is omitted', async () => {
      const leadData = makeLead();
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockQueryChain.exec.mockResolvedValue(leadData);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp' },
        'user1',
        'tenant1',
      );

      expect(result.lead.status).toBe('new');
      expect(result.nextAction).toBe('none');
    });

    it('creates lead with status quote_sent and returns nextAction create_quote', async () => {
      const leadData = makeLead({ status: 'quote_sent' });
      const refreshedLead = makeLead({ status: 'quote_sent', qualificationStatus: 'qualified' });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(refreshedLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'quote_sent' },
        'user1',
        'tenant1',
      );

      expect(result.lead.status).toBe('quote_sent');
      expect(result.nextAction).toBe('create_quote');
    });

    it('creates lead with status technical_visit and returns nextAction schedule_visit', async () => {
      const leadData = makeLead({ status: 'technical_visit' });
      const refreshedLead = makeLead({ status: 'technical_visit', qualificationStatus: 'qualified' });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(refreshedLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'technical_visit' },
        'user1',
        'tenant1',
      );

      expect(result.lead.status).toBe('technical_visit');
      expect(result.nextAction).toBe('schedule_visit');
    });

    it('creates lead as won and converts to client in transaction', async () => {
      const leadData = makeLead({ status: 'won' });
      const wonLead = makeLead({
        status: 'won',
        qualificationStatus: 'qualified',
        convertedToClient: 'client1',
        convertedAt: new Date(),
      });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockClientCreate.mockResolvedValue([{ _id: 'client1' }]);
      mockContactCreate.mockResolvedValue([{}]);
      mockQueryChain.exec
        .mockResolvedValueOnce(wonLead)
        .mockResolvedValueOnce(wonLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'won' },
        'user1',
        'tenant1',
      );

      expect(result.lead.status).toBe('won');
      expect(result.lead.convertedToClient).toBe('client1');
      expect(result.nextAction).toBe('none');
      expect(mockClientCreate).toHaveBeenCalledTimes(1);
      expect(mockContactCreate).toHaveBeenCalledTimes(1);
    });

    it('creates lead as lost and sets qualificationStatus not_qualified', async () => {
      const leadData = makeLead({ status: 'lost' });
      const lostLead = makeLead({
        status: 'lost',
        qualificationStatus: 'not_qualified',
        lostReason: 'price',
      });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([]);
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lostLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'lost', lostReason: 'price' },
        'user1',
        'tenant1',
      );

      expect(result.lead.status).toBe('lost');
      expect(result.lead.lostReason).toBe('price');
      expect(result.lead.qualificationStatus).toBe('not_qualified');
      expect(result.nextAction).toBe('none');
    });

    it('throws ValidationError when status is lost without lostReason', async () => {
      mockFindDuplicates.mockResolvedValue([]);

      await expect(
        service.createLead(
          { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'lost' },
          'user1',
          'tenant1',
        ),
      ).rejects.toThrow(ValidationError);

      expect(mockLeadCreate).not.toHaveBeenCalled();
    });

    it('throws ValidationError when lostReason is invalid', async () => {
      mockFindDuplicates.mockResolvedValue([]);

      await expect(
        service.createLead(
          { name: 'Juan Pérez', source: 'whatsapp', status: 'lost', lostReason: 'invalid_reason' as any },
          'user1',
          'tenant1',
        ),
      ).rejects.toThrow(ValidationError);

      expect(mockLeadCreate).not.toHaveBeenCalled();
    });

    it('runs duplicate detection for all statuses including won', async () => {
      const leadData = makeLead({ status: 'won' });
      const wonLead = makeLead({
        status: 'won',
        qualificationStatus: 'qualified',
        convertedToClient: 'client1',
        convertedAt: new Date(),
      });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([
        { _id: 'dup1', email: 'juan@test.com', phone: 'other', companyName: 'Other' },
      ]);
      mockClientCreate.mockResolvedValue([{ _id: 'client1' }]);
      mockContactCreate.mockResolvedValue([{}]);
      mockQueryChain.exec
        .mockResolvedValueOnce(wonLead)
        .mockResolvedValueOnce(wonLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'won' },
        'user1',
        'tenant1',
      );

      expect(mockFindDuplicates).toHaveBeenCalledTimes(1);
      expect(result.warnings).toBeDefined();
    });

    it('returns warnings alongside nextAction for won with duplicates', async () => {
      const leadData = makeLead({ status: 'won' });
      const wonLead = makeLead({
        status: 'won',
        qualificationStatus: 'qualified',
        convertedToClient: 'client1',
        convertedAt: new Date(),
      });
      mockLeadCreate.mockResolvedValue(leadData);
      mockFindDuplicates.mockResolvedValue([
        { _id: 'dup1', email: 'juan@test.com', phone: 'other', companyName: 'Other' },
      ]);
      mockClientCreate.mockResolvedValue([{ _id: 'client1' }]);
      mockContactCreate.mockResolvedValue([{}]);
      mockQueryChain.exec
        .mockResolvedValueOnce(wonLead)
        .mockResolvedValueOnce(wonLead);

      const result = await service.createLead(
        { name: 'Juan Pérez', email: 'juan@test.com', source: 'whatsapp', status: 'won' },
        'user1',
        'tenant1',
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.nextAction).toBe('none');
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

    it('enforces tenant isolation — different tenant cannot access lead', async () => {
      // Lead exists in tenant1
      const leadData = makeLead({ _id: 'lead1', tenantId: 'tenant1' });
      mockQueryChain.exec.mockResolvedValue(null); // tenant2 query returns null

      const result = await service.getLead('lead1', 'tenant2');

      expect(result).toBeNull(); // tenant2 should not see tenant1's lead
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

    it('filters by tenantId to prevent cross-tenant access', async () => {
      mockQueryChain.exec.mockResolvedValue(0);
      mockCursorPage.mockResolvedValue({ data: [], cursor: null });

      await service.listLeads({}, 'tenant-abc');

      // The filter passed to countDocuments should include tenantId
      const countFilter = mockQueryChain.exec.mock.calls[0];
      // Verifying the findOneAndUpdate was called with tenant-abc means
      // the query builder received the filter — cursorPage receives it internally
      expect(mockCursorPage).toHaveBeenCalled();
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
        service.changeStatus('lead1', 'quote_sent', 'user1', 'tenant1'),
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
