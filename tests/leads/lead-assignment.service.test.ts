import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockLeadAssignmentCreate } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = { lean: vi.fn(), sort: vi.fn(), exec };
  chain.lean.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return {
    mockQueryChain: chain,
    mockLeadAssignmentCreate: vi.fn(),
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

vi.mock('../../src/leads/models/lead-assignment', () => ({
  default: {
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    find: vi.fn().mockReturnValue(mockQueryChain),
    create: mockLeadAssignmentCreate,
  },
}));

vi.mock('../../src/leads/models/lead', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { LeadAssignmentService } from '../../src/leads/services/lead-assignment.service';

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'assignment1',
    tenantId: 'tenant1',
    leadId: 'lead1',
    userId: 'user2',
    assignedBy: 'user1',
    assignedAt: new Date(),
    unassignedAt: null,
    reason: undefined,
    toObject() { return { ...this }; },
    ...overrides,
  };
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead1',
    tenantId: 'tenant1',
    name: 'Juan Pérez',
    status: 'new',
    assignedTo: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('LeadAssignmentService', () => {
  let service: LeadAssignmentService;

  beforeEach(() => {
    service = new LeadAssignmentService();
    vi.clearAllMocks();
  });

  describe('assign', () => {
    it('creates assignment and updates lead.assignedTo', async () => {
      const leadData = makeLead();
      const assignmentData = makeAssignment();
      const updatedLead = makeLead({ assignedTo: 'user2' });

      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(updatedLead);

      mockLeadAssignmentCreate.mockResolvedValue(assignmentData);

      const result = await service.assign('lead1', 'user2', 'user1', 'tenant1');

      expect(result.assignment).toBeDefined();
      expect(result.lead).toBeDefined();
      expect(mockLeadAssignmentCreate).toHaveBeenCalled();
    });

    it('throws error when lead does not exist', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      await expect(
        service.assign('nonexistent', 'user2', 'user1', 'tenant1'),
      ).rejects.toThrow('not found');
    });

    it('closes previous active assignment before creating new one', async () => {
      const leadData = makeLead();
      const previousAssignment = makeAssignment({ _id: 'old-assignment' });
      const newAssignment = makeAssignment({ _id: 'new-assignment' });
      const updatedLead = makeLead({ assignedTo: 'user2' });

      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)
        .mockResolvedValueOnce(previousAssignment)
        .mockResolvedValueOnce(updatedLead);

      mockLeadAssignmentCreate.mockResolvedValue(newAssignment);

      await service.assign('lead1', 'user2', 'user1', 'tenant1');

      expect(mockLeadAssignmentCreate).toHaveBeenCalled();
    });
  });

  describe('unassign', () => {
    it('clears assignedTo and closes assignment', async () => {
      const activeAssignment = makeAssignment();
      const updatedLead = makeLead({ assignedTo: null });

      mockQueryChain.exec
        .mockResolvedValueOnce(activeAssignment)
        .mockResolvedValueOnce(updatedLead);

      const result = await service.unassign('lead1', 'tenant1', 'user1');

      expect(result.lead.assignedTo).toBeNull();
      expect(result.assignment).toBeDefined();
    });

    it('throws error when no active assignment', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      await expect(
        service.unassign('lead1', 'tenant1', 'user1'),
      ).rejects.toThrow('No active assignment');
    });
  });

  describe('reassign', () => {
    it('closes previous assignment and creates new one', async () => {
      const leadData = makeLead();
      const oldAssignment = makeAssignment({ _id: 'old' });
      const newAssignment = makeAssignment({ _id: 'new', userId: 'user3' });
      const updatedLead = makeLead({ assignedTo: 'user3' });

      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)
        .mockResolvedValueOnce(oldAssignment)
        .mockResolvedValueOnce(updatedLead);

      mockLeadAssignmentCreate.mockResolvedValue(newAssignment);

      const result = await service.reassign('lead1', 'user3', 'user1', 'tenant1');

      expect(result.assignment).toBeDefined();
    });

    it('handles multiple sequential reassignments correctly', async () => {
      // Simulate: assign to user2 → reassign to user3 → reassign to user4
      const leadData = makeLead();

      // First reassign: user1 → user2
      const assignment1 = makeAssignment({ _id: 'a1', userId: 'user2' });
      const updatedLead1 = makeLead({ assignedTo: 'user2' });
      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)  // find lead
        .mockResolvedValueOnce(null)       // no previous active assignment
        .mockResolvedValueOnce(updatedLead1);
      mockLeadAssignmentCreate.mockResolvedValue(assignment1);

      const result1 = await service.assign('lead1', 'user2', 'user1', 'tenant1');
      expect(result1.lead.assignedTo).toBe('user2');

      vi.clearAllMocks();

      // Second reassign: user2 → user3
      const oldActive1 = makeAssignment({ _id: 'a1', userId: 'user2', unassignedAt: null });
      const assignment2 = makeAssignment({ _id: 'a2', userId: 'user3' });
      const updatedLead2 = makeLead({ assignedTo: 'user3' });
      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)
        .mockResolvedValueOnce(oldActive1)
        .mockResolvedValueOnce(updatedLead2);
      mockLeadAssignmentCreate.mockResolvedValue(assignment2);

      const result2 = await service.reassign('lead1', 'user3', 'user1', 'tenant1');
      expect(result2.lead.assignedTo).toBe('user3');

      vi.clearAllMocks();

      // Third reassign: user3 → user4
      const oldActive2 = makeAssignment({ _id: 'a2', userId: 'user3', unassignedAt: null });
      const assignment3 = makeAssignment({ _id: 'a3', userId: 'user4' });
      const updatedLead3 = makeLead({ assignedTo: 'user4' });
      mockQueryChain.exec
        .mockResolvedValueOnce(leadData)
        .mockResolvedValueOnce(oldActive2)
        .mockResolvedValueOnce(updatedLead3);
      mockLeadAssignmentCreate.mockResolvedValue(assignment3);

      const result3 = await service.reassign('lead1', 'user4', 'user1', 'tenant1');
      expect(result3.lead.assignedTo).toBe('user4');
    });
  });

  describe('getAssignmentHistory', () => {
    it('returns ordered history for a lead', async () => {
      const history = [
        makeAssignment({ _id: 'a1', assignedAt: new Date('2026-06-03') }),
        makeAssignment({ _id: 'a2', assignedAt: new Date('2026-06-02') }),
        makeAssignment({ _id: 'a3', assignedAt: new Date('2026-06-01') }),
      ];
      mockQueryChain.exec.mockResolvedValue(history);

      const result = await service.getAssignmentHistory('lead1', 'tenant1');

      expect(result).toHaveLength(3);
    });

    it('returns empty array when no assignments exist', async () => {
      mockQueryChain.exec.mockResolvedValue([]);

      const result = await service.getAssignmentHistory('lead1', 'tenant1');

      expect(result).toHaveLength(0);
    });
  });
});
