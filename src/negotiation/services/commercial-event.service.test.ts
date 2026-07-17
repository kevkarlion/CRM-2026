import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommercialEventService } from './commercial-event.service';
import { NegotiationModel } from '../models';

vi.mock('../models', () => ({
  NegotiationModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../activity/services/activity.service', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({}),
  })),
}));

describe('CommercialEventService', () => {
  let service: CommercialEventService;

  beforeEach(() => {
    service = new CommercialEventService();
    vi.clearAllMocks();
  });

  it('adds event to open negotiation', async () => {
    const mockNegotiation = {
      _id: 'nego1',
      status: 'open',
      leadId: { toString: () => 'lead1' },
    };

    const mockUpdated = {
      _id: 'nego1',
      status: 'open',
      toObject: () => ({
        _id: 'nego1',
        commercialEvents: [{ eventType: 'discount_request', description: 'Client wants 10% off' }],
      }),
    };

    vi.mocked(NegotiationModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockNegotiation),
    } as any);

    vi.mocked(NegotiationModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockUpdated),
    } as any);

    const result = await service.addEvent(
      'nego1',
      { eventType: 'discount_request', description: 'Client wants 10% off' },
      '000000000000000000000001',
      '000000000000000000000002',
    );

    expect(NegotiationModel.findOneAndUpdate).toHaveBeenCalled();
    expect(result.commercialEvents[0].eventType).toBe('discount_request');
  });

  it('throws error if negotiation is terminal', async () => {
    const mockNegotiation = { _id: 'nego1', status: 'accepted' };

    vi.mocked(NegotiationModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockNegotiation),
    } as any);

    await expect(
      service.addEvent('nego1', { eventType: 'other', description: 'test' }, '000000000000000000000001', '000000000000000000000002'),
    ).rejects.toThrow('Cannot add commercial event');
  });
});
