import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CounterOfferService } from './counter-offer.service';
import { NegotiationModel, NegotiationEventModel } from '../models';

vi.mock('../models', () => ({
  NegotiationModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  NegotiationEventModel: {
    create: vi.fn(),
  },
}));

vi.mock('../../activity/services/activity.service', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({}),
  })),
}));

describe('CounterOfferService', () => {
  let service: CounterOfferService;

  beforeEach(() => {
    service = new CounterOfferService();
    vi.clearAllMocks();
  });

  describe('addCounterOffer', () => {
    it('adds counteroffer and transitions open → counteroffer_made', async () => {
      const mockNegotiation = {
        _id: '000000000000000000000011',
        status: 'open',
        leadId: { toString: () => 'lead1' },
      };

      const mockUpdated = {
        _id: '000000000000000000000011',
        status: 'counteroffer_made',
        toObject: () => ({ _id: '000000000000000000000011', status: 'counteroffer_made' }),
      };

      vi.mocked(NegotiationModel.findOne).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockNegotiation),
      } as any);

      vi.mocked(NegotiationModel.findOneAndUpdate).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUpdated),
      } as any);

      vi.mocked(NegotiationEventModel.create).mockResolvedValue({} as any);

      const result = await service.addCounterOffer(
        '000000000000000000000011',
        { amount: 1000, terms: '30 days', validUntil: new Date('2099-12-31'), reason: 'Too expensive' },
        '000000000000000000000001',
        '000000000000000000000002',
      );

      expect(NegotiationModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result.status).toBe('counteroffer_made');
    });

    it('throws error if negotiation is terminal', async () => {
      const mockNegotiation = { _id: 'nego1', status: 'accepted' };

      vi.mocked(NegotiationModel.findOne).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockNegotiation),
      } as any);

      await expect(
        service.addCounterOffer('nego1', { amount: 1000, terms: '30 days', validUntil: new Date() }, '000000000000000000000001', '000000000000000000000002'),
      ).rejects.toThrow('Cannot add counteroffer');
    });
  });

  describe('updateCounterOfferStatus', () => {
    it('updates status and sets respondedAt on terminal status', async () => {
      const mockNegotiation = {
        _id: 'nego1',
        leadId: { toString: () => 'lead1' },
        counterOffers: [{ status: 'pending' }],
      };

      const mockUpdated = {
        _id: 'nego1',
        toObject: () => ({
          _id: 'nego1',
          counterOffers: [{ status: 'accepted', respondedAt: new Date() }],
        }),
      };

      vi.mocked(NegotiationModel.findOne).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockNegotiation),
      } as any);

      vi.mocked(NegotiationModel.findOneAndUpdate).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUpdated),
      } as any);

      const result = await service.updateCounterOfferStatus('nego1', 0, 'accepted', '000000000000000000000001', '000000000000000000000002');

      expect(NegotiationModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result.counterOffers[0].status).toBe('accepted');
    });

    it('throws error if counteroffer is already terminal', async () => {
      const mockNegotiation = {
        _id: 'nego1',
        leadId: { toString: () => 'lead1' },
        counterOffers: [{ status: 'accepted' }],
      };

      vi.mocked(NegotiationModel.findOne).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockNegotiation),
      } as any);

      await expect(
        service.updateCounterOfferStatus('nego1', 0, 'rejected', '000000000000000000000001', '000000000000000000000002'),
      ).rejects.toThrow('Cannot update counteroffer in terminal status');
    });
  });
});
