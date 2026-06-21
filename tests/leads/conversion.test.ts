import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain, mockSession, mockClientCreate, mockContactCreate, mockActivityCreate } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = { lean: vi.fn(), exec };
  chain.lean.mockReturnValue(chain);
  return {
    mockQueryChain: chain,
    mockSession: {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      abortTransaction: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn(),
    },
    mockClientCreate: vi.fn(),
    mockContactCreate: vi.fn(),
    mockActivityCreate: vi.fn(),
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
    startSession: vi.fn().mockResolvedValue(mockSession),
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
      model: vi.fn(),
      startSession: vi.fn().mockResolvedValue(mockSession),
    },
  };
});

vi.mock('../../src/leads/models/lead', () => ({
  default: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
  },
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

vi.mock('../../src/crm/models/activity', () => ({
  default: {
    create: mockActivityCreate,
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { LeadService, ValidationError, ConflictError } from '../../src/leads/services/lead.service';

function makeQualifiedLead(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead1',
    tenantId: 'tenant1',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    source: 'whatsapp',
    status: 'qualified',
    companyName: 'Climax SA',
    notes: 'Cliente interesado en split',
    assignedTo: null,
    convertedToClient: null,
    convertedAt: null,
    createdBy: 'user1',
    updatedBy: 'user1',
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('LeadService — convertToClient', () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService();
    vi.clearAllMocks();
  });

  describe('successful conversion', () => {
    it('converts a qualified lead to client', async () => {
      const qualifiedLead = makeQualifiedLead();
      const createdClient = {
        _id: 'client1',
        tenantId: 'tenant1',
        fullName: 'Juan Pérez',
        companyName: 'Climax SA',
        toObject() { return { _id: 'client1', fullName: 'Juan Pérez', companyName: 'Climax SA' }; },
      };
      const createdContact = {
        _id: 'contact1',
        tenantId: 'tenant1',
        clientId: 'client1',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@example.com',
        phone: '+5491112345678',
        toObject() { return { _id: 'contact1', firstName: 'Juan', lastName: 'Pérez' }; },
      };
      const updatedLead = makeQualifiedLead({
        status: 'won',
        convertedToClient: 'client1',
        convertedAt: new Date(),
        toObject() { return { ...this, status: 'won', convertedToClient: 'client1' }; },
      });

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead)
        .mockResolvedValueOnce(updatedLead);

      mockClientCreate.mockResolvedValue([createdClient]);
      mockContactCreate.mockResolvedValue([createdContact]);
      mockActivityCreate.mockResolvedValue([{ _id: 'act1' }]);

      const result = await service.convertToClient('lead1', 'user1', 'tenant1');

      expect(result.client).toBeDefined();
      expect(result.client.fullName).toBe('Juan Pérez');
      expect(result.contact).toBeDefined();
      expect(result.lead).toBeDefined();
      expect(result.lead.status).toBe('won');
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('creates Client with Lead.name and companyName', async () => {
      const qualifiedLead = makeQualifiedLead();
      const createdClient = {
        _id: 'client1',
        toObject() { return { _id: 'client1', fullName: 'Juan Pérez', companyName: 'Climax SA' }; },
      };
      const createdContact = {
        _id: 'contact1',
        toObject() { return { _id: 'contact1' }; },
      };
      const updatedLead = makeQualifiedLead({
        status: 'won',
        toObject() { return { status: 'won' }; },
      });

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead)
        .mockResolvedValueOnce(updatedLead);

      mockClientCreate.mockResolvedValue([createdClient]);
      mockContactCreate.mockResolvedValue([createdContact]);
      mockActivityCreate.mockResolvedValue([{ _id: 'act1' }]);

      await service.convertToClient('lead1', 'user1', 'tenant1');

      expect(mockClientCreate).toHaveBeenCalledWith(
        [expect.objectContaining({
          fullName: 'Juan Pérez',
          companyName: 'Climax SA',
        })],
        expect.objectContaining({ session: mockSession }),
      );
    });

    it('creates Contact with Lead.email and phone', async () => {
      const qualifiedLead = makeQualifiedLead();
      const createdClient = { _id: 'client1', toObject() { return {}; } };
      const createdContact = { _id: 'contact1', toObject() { return {}; } };
      const updatedLead = makeQualifiedLead({ status: 'won', toObject() { return { status: 'won' }; } });

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead)
        .mockResolvedValueOnce(updatedLead);

      mockClientCreate.mockResolvedValue([createdClient]);
      mockContactCreate.mockResolvedValue([createdContact]);
      mockActivityCreate.mockResolvedValue([{ _id: 'act1' }]);

      await service.convertToClient('lead1', 'user1', 'tenant1');

      expect(mockContactCreate).toHaveBeenCalledWith(
        [expect.objectContaining({
          email: 'juan@example.com',
          phone: '+5491112345678',
          isPrimary: true,
        })],
        expect.objectContaining({ session: mockSession }),
      );
    });

    it('copies lead notes as Activity', async () => {
      const qualifiedLead = makeQualifiedLead();
      const createdClient = { _id: 'client1', toObject() { return {}; } };
      const createdContact = { _id: 'contact1', toObject() { return {}; } };
      const updatedLead = makeQualifiedLead({ status: 'won', toObject() { return { status: 'won' }; } });

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead)
        .mockResolvedValueOnce(updatedLead);

      mockClientCreate.mockResolvedValue([createdClient]);
      mockContactCreate.mockResolvedValue([createdContact]);
      mockActivityCreate.mockResolvedValue([{ _id: 'act1' }]);

      await service.convertToClient('lead1', 'user1', 'tenant1');

      const notesCalls = mockActivityCreate.mock.calls.filter(
        (call: any) => call[0]?.[0]?.title === 'Notas del Lead original',
      );
      expect(notesCalls).toHaveLength(1);
      expect(notesCalls[0][0][0].description).toBe('Cliente interesado en split');
    });
  });

  describe('error states', () => {
    it('throws ValidationError when lead status is not qualified', async () => {
      const nonQualifiedLead = makeQualifiedLead({ status: 'new' });
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(nonQualifiedLead);

      await expect(
        service.convertToClient('lead1', 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when lead already converted', async () => {
      const alreadyConvertedLead = makeQualifiedLead({
        status: 'won',
        convertedToClient: 'client1',
      });
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(alreadyConvertedLead);

      await expect(
        service.convertToClient('lead1', 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws Error when lead does not exist', async () => {
      mockQueryChain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.convertToClient('nonexistent', 'user1', 'tenant1'),
      ).rejects.toThrow('Lead not found');
    });

    it('throws ConflictError when lead was already converted concurrently', async () => {
      const qualifiedLead = makeQualifiedLead();
      const createdClient = { _id: 'client1', toObject() { return {}; } };
      const createdContact = { _id: 'contact1', toObject() { return {}; } };

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead)
        .mockResolvedValueOnce(null);

      mockClientCreate.mockResolvedValue([createdClient]);
      mockContactCreate.mockResolvedValue([createdContact]);
      mockActivityCreate.mockResolvedValue([{ _id: 'act1' }]);

      await expect(
        service.convertToClient('lead1', 'user1', 'tenant1'),
      ).rejects.toThrow(ConflictError);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('aborts transaction and rethrows on error', async () => {
      const qualifiedLead = makeQualifiedLead();

      mockQueryChain.exec
        .mockResolvedValueOnce(qualifiedLead);

      mockClientCreate.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.convertToClient('lead1', 'user1', 'tenant1'),
      ).rejects.toThrow('DB write failed');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
