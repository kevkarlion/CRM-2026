import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const chain: any = { populate: vi.fn(), exec: vi.fn() };
  chain.populate.mockReturnValue(chain);

  return {
    chain,
    publish: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    findOne: vi.fn(() => chain),
    findOneAndUpdate: vi.fn(() => chain),
  };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    private value: string;
    constructor(_id?: string) {
      this.value = _id || '';
    }
    toString() {
      return this.value;
    }
  }
  return {
    Types: { ObjectId: MockObjectId as any },
    default: {
      Types: { ObjectId: MockObjectId as any },
    },
  };
});

vi.mock('@/crm/models', () => ({
  ClientModel: {
    create: hoisted.create,
    findOne: hoisted.findOne,
    findOneAndUpdate: hoisted.findOneAndUpdate,
  },
  ContactModel: {},
  LocationModel: {},
  EquipmentModel: {},
  TaskModel: {},
}));

vi.mock('@/crm/helpers/cursor-pagination', () => ({
  cursorPage: vi.fn(),
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.publish },
}));

import { ClientService } from '@/crm/services/client.service';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'cccccccccccccccccccccccc';

function clientDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CLIENT_ID,
    tenantId: TENANT_ID,
    status: 'active',
    fullName: 'Empresa ACME',
    companyName: 'ACME SA',
    customerType: 'commercial',
    email: 'acme@test.com',
    phone: '555-0001',
    source: 'form',
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function publishedPayload(type: string) {
  const call = hoisted.publish.mock.calls.find((c: any[]) => c[0].type === type);
  return call ? call[0].payload : undefined;
}

describe('ClientService publishes client domain events', () => {
  let service: ClientService;

  beforeEach(() => {
    service = new ClientService();
    vi.clearAllMocks();
    hoisted.chain.exec.mockReset();
  });

  it('create publishes CLIENT_CREATED with the client identifier and name', async () => {
    hoisted.create.mockResolvedValue(clientDoc());

    const client = await service.create(
      {
        fullName: 'Empresa ACME',
        customerType: 'commercial',
        email: 'acme@test.com',
        phone: '555-0001',
        source: 'form',
      } as any,
      TENANT_ID,
      USER_ID,
    );

    expect(client.toObject()._id).toBe(CLIENT_ID);
    const payload = publishedPayload(DOMAIN_EVENTS.CLIENT_CREATED);
    expect(payload?.clientId).toBe(CLIENT_ID);
    expect(payload?.name).toBe('Empresa ACME');
    expect(payload?.customerType).toBe('commercial');
    expect(payload?.email).toBe('acme@test.com');
  });

  it('create still succeeds when publishing CLIENT_CREATED fails', async () => {
    hoisted.publish.mockRejectedValueOnce(new Error('bus down'));
    hoisted.create.mockResolvedValue(clientDoc());

    const client = await service.create(
      { fullName: 'Empresa ACME', customerType: 'commercial' } as any,
      TENANT_ID,
      USER_ID,
    );

    expect(client.toObject()._id).toBe(CLIENT_ID);
  });

  it('blockClient publishes CLIENT_STATUS_CHANGED with from active to blocked and reason', async () => {
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc());
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc({ status: 'blocked' }));

    const client = await service.blockClient(CLIENT_ID, 'Mora de pago', TENANT_ID, USER_ID);

    expect(client.status).toBe('blocked');
    const payload = publishedPayload(DOMAIN_EVENTS.CLIENT_STATUS_CHANGED);
    expect(payload?.clientId).toBe(CLIENT_ID);
    expect(payload?.from).toBe('active');
    expect(payload?.to).toBe('blocked');
    expect(payload?.reason).toBe('Mora de pago');
    expect(payload?.name).toBe('Empresa ACME');
  });

  it('unblockClient publishes CLIENT_STATUS_CHANGED from blocked to active', async () => {
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc({ status: 'blocked' }));
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc({ status: 'active' }));

    const client = await service.unblockClient(CLIENT_ID, TENANT_ID, USER_ID);

    expect(client.status).toBe('active');
    const payload = publishedPayload(DOMAIN_EVENTS.CLIENT_STATUS_CHANGED);
    expect(payload?.clientId).toBe(CLIENT_ID);
    expect(payload?.from).toBe('blocked');
    expect(payload?.to).toBe('active');
  });

  it('blockClient still succeeds when publishing CLIENT_STATUS_CHANGED fails', async () => {
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc());
    hoisted.chain.exec.mockResolvedValueOnce(clientDoc({ status: 'blocked' }));
    hoisted.publish.mockRejectedValueOnce(new Error('bus down'));

    const client = await service.blockClient(CLIENT_ID, 'Mora de pago', TENANT_ID, USER_ID);

    expect(client.status).toBe('blocked');
  });
});
