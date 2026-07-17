import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FollowUpService } from './follow-up.service';
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

describe('FollowUpService', () => {
  let service: FollowUpService;

  beforeEach(() => {
    service = new FollowUpService();
    vi.clearAllMocks();
  });

  it('creates followUp on negotiation without one', async () => {
    const mockNegotiation = {
      _id: 'nego1',
      status: 'open',
      leadId: { toString: () => 'lead1' },
      followUp: null,
    };

    const mockUpdated = {
      _id: 'nego1',
      toObject: () => ({
        _id: 'nego1',
        followUp: { priority: 'high', nextContactDate: new Date('2025-02-01') },
      }),
    };

    vi.mocked(NegotiationModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockNegotiation),
    } as any);

    vi.mocked(NegotiationModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockUpdated),
    } as any);

    const result = await service.updateFollowUp(
      'nego1',
      { nextContactDate: new Date('2025-02-01'), priority: 'high' },
      '000000000000000000000001',
      '000000000000000000000002',
    );

    expect(NegotiationModel.findOneAndUpdate).toHaveBeenCalled();
    expect(result.followUp.priority).toBe('high');
  });

  it('overwrites existing followUp (no merge)', async () => {
    const mockNegotiation = {
      _id: 'nego1',
      status: 'open',
      leadId: { toString: () => 'lead1' },
      followUp: { priority: 'low', internalNotes: 'old notes' },
    };

    const mockUpdated = {
      _id: 'nego1',
      toObject: () => ({
        _id: 'nego1',
        followUp: { priority: 'high', internalNotes: 'new notes' },
      }),
    };

    vi.mocked(NegotiationModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockNegotiation),
    } as any);

    vi.mocked(NegotiationModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockUpdated),
    } as any);

    const result = await service.updateFollowUp(
      'nego1',
      { priority: 'high', internalNotes: 'new notes' },
      '000000000000000000000001',
      '000000000000000000000002',
    );

    expect(result.followUp.priority).toBe('high');
    expect(result.followUp.internalNotes).toBe('new notes');
  });

  it('throws error if negotiation is terminal', async () => {
    const mockNegotiation = { _id: 'nego1', status: 'accepted' };

    vi.mocked(NegotiationModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockNegotiation),
    } as any);

    await expect(
      service.updateFollowUp('nego1', { priority: 'high' }, '000000000000000000000001', '000000000000000000000002'),
    ).rejects.toThrow('Cannot update followUp');
  });
});
