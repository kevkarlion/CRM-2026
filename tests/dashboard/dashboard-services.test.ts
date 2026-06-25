import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/crm/models/index', () => ({
  ClientModel: { countDocuments: vi.fn() },
}));

vi.mock('../../src/operations/models/index', () => ({
  WorkOrderModel: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
  WorkOrderAssignmentModel: { aggregate: vi.fn() },
}));

vi.mock('../../src/quotes/models/index', () => ({
  QuoteModel: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../src/leads/models/index', () => ({
  LeadModel: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../src/contracts/models/index', () => ({
  ContractModel: {
    countDocuments: vi.fn(),
    distinct: vi.fn(),
  },
  MaintenanceScheduleModel: { countDocuments: vi.fn() },
  ContractEquipmentModel: { countDocuments: vi.fn() },
}));

import { DashboardMetricsService } from '../../src/dashboard/services/dashboard-metrics.service';
import { DashboardOperationsService } from '../../src/dashboard/services/dashboard-operations.service';
import { DashboardCommercialService } from '../../src/dashboard/services/dashboard-commercial.service';
import { DashboardContractsService } from '../../src/dashboard/services/dashboard-contracts.service';

const TENANT = '507f1f77bcf86cd799439011';

describe('DashboardMetricsService', () => {
  let service: DashboardMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardMetricsService();
  });

  it('returns a summary with all metric types', async () => {
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    const clientCount = vi.mocked(ClientModel.countDocuments);
    const woCount = vi.mocked(WorkOrderModel.countDocuments);
    const contractCount = vi.mocked(ContractModel.countDocuments);
    const contractDistinct = vi.mocked(ContractModel.distinct);
    const leadCount = vi.mocked(LeadModel.countDocuments);
    const quoteCount = vi.mocked(QuoteModel.countDocuments);
    const quoteAgg = vi.mocked(QuoteModel.aggregate);
    const maintCount = vi.mocked(MaintenanceScheduleModel.countDocuments);

    clientCount.mockResolvedValueOnce(50).mockResolvedValueOnce(5);
    contractDistinct.mockResolvedValue(['c1', 'c2', 'c3']);
    woCount.mockResolvedValueOnce(12).mockResolvedValueOnce(8).mockResolvedValueOnce(15);
    leadCount.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    quoteCount.mockResolvedValueOnce(20).mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    quoteAgg.mockResolvedValue([{ _id: null, total: 150000 }]);
    contractCount.mockResolvedValueOnce(25).mockResolvedValueOnce(5);
    maintCount.mockResolvedValue(8);

    const result = await service.getSummary(TENANT);

    expect(result.clients.total).toBe(50);
    expect(result.clients.newThisMonth).toBe(5);
    expect(result.clients.activeWithContracts).toBe(3);
    expect(result.workOrders.pending).toBe(12);
    expect(result.workOrders.inProgress).toBe(8);
    expect(result.workOrders.completedThisMonth).toBe(15);
    expect(result.leads.new).toBe(10);
    expect(result.leads.qualified).toBe(3);
    expect(result.quotes.sent).toBe(20);
    expect(result.quotes.approved).toBe(10);
    expect(result.quotes.totalEstimatedValue).toBe(150000);
    expect(result.contracts.active).toBe(25);
    expect(result.contracts.expiringSoon).toBe(5);
    expect(result.contracts.upcomingMaintenance).toBe(8);
    expect(result).toHaveProperty('generatedAt');
  });

  it('handles zero data gracefully', async () => {
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    const clientCount = vi.mocked(ClientModel.countDocuments);
    const woCount = vi.mocked(WorkOrderModel.countDocuments);
    const contractCount = vi.mocked(ContractModel.countDocuments);
    const contractDistinct = vi.mocked(ContractModel.distinct);
    const leadCount = vi.mocked(LeadModel.countDocuments);
    const quoteCount = vi.mocked(QuoteModel.countDocuments);
    const quoteAgg = vi.mocked(QuoteModel.aggregate);
    const maintCount = vi.mocked(MaintenanceScheduleModel.countDocuments);

    clientCount.mockResolvedValue(0);
    woCount.mockResolvedValue(0);
    leadCount.mockResolvedValue(0);
    quoteCount.mockResolvedValue(0);
    quoteAgg.mockResolvedValue([]);
    contractCount.mockResolvedValue(0);
    maintCount.mockResolvedValue(0);
    contractDistinct.mockResolvedValue([]);

    const result = await service.getSummary(TENANT);

    expect(result.clients.total).toBe(0);
    expect(result.clients.activeWithContracts).toBe(0);
    expect(result.leads.conversionRate).toBe(0);
    expect(result.quotes.totalEstimatedValue).toBe(0);
  });
});

describe('DashboardOperationsService', () => {
  let service: DashboardOperationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardOperationsService();
  });

  it('returns operations metrics', async () => {
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    const woCount = vi.mocked(WorkOrderModel.countDocuments);
    const woFind = vi.mocked(WorkOrderModel.find);
    const assignAgg = vi.mocked(WorkOrderAssignmentModel.aggregate);

    woCount.mockResolvedValueOnce(15).mockResolvedValueOnce(10).mockResolvedValueOnce(3).mockResolvedValueOnce(20);

    const mockCompleted = [
      { createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01T02:00:00Z') },
      { createdAt: new Date('2025-01-05'), updatedAt: new Date('2025-01-06T00:00:00Z') },
    ];

    woFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(mockCompleted),
    } as any);

    assignAgg.mockResolvedValue([
      { _id: 'tech-1', technicianName: 'Ana Gómez', assignedCount: 5 },
    ]);

    const result = await service.getOperationsMetrics(TENANT);

    expect(result.pendingOrders).toBe(15);
    expect(result.inProgressOrders).toBe(10);
    expect(result.completedToday).toBe(3);
    expect(result.upcomingSevenDays).toBe(20);
    // Both WOs within 48h → onTime
    expect(result.sla.onTime).toBe(2);
    expect(result.sla.delayed).toBe(0);
    expect(result.technicianLoad).toHaveLength(1);
    expect(result.technicianLoad[0].name).toBe('Ana Gómez');
  });

  it('returns default SLA when no completed orders exist', async () => {
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(0);
    vi.mocked(WorkOrderModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(WorkOrderAssignmentModel.aggregate).mockResolvedValue([]);

    const result = await service.getOperationsMetrics(TENANT);

    expect(result.sla.onTime).toBe(0);
    expect(result.sla.delayed).toBe(0);
    expect(result.sla.avgResponseTimeHours).toBeNull();
  });
});

describe('DashboardCommercialService', () => {
  let service: DashboardCommercialService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardCommercialService();
  });

  it('returns commercial metrics', async () => {
    const { LeadModel } = await import('../../src/leads/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');

    const leadAgg = vi.mocked(LeadModel.aggregate);
    const leadCount = vi.mocked(LeadModel.countDocuments);
    const quoteAgg = vi.mocked(QuoteModel.aggregate);

    leadAgg.mockResolvedValue([
      { _id: 'new', count: 10 },
      { _id: 'qualified', count: 5 },
    ]);
    leadCount.mockResolvedValueOnce(3).mockResolvedValueOnce(20).mockResolvedValueOnce(5);

    quoteAgg
      .mockResolvedValueOnce([
        { _id: 'sent', count: 8 },
        { _id: 'approved', count: 4 },
      ])
      .mockResolvedValueOnce([
        { _id: 'c1', totalQuoted: 50000, name: 'Cliente A' },
      ]);

    const result = await service.getCommercialMetrics(TENANT);

    expect(result.leadsByStage).toHaveLength(2);
    expect(result.newLeadsThisMonth).toBe(3);
    expect(result.conversionRate).toBe(25);
    expect(result.quotesByStatus).toHaveLength(2);
    expect(result.topClients).toHaveLength(1);
    expect(result.topClients[0].name).toBe('Cliente A');
  });
});

describe('DashboardContractsService', () => {
  let service: DashboardContractsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardContractsService();
  });

  it('returns contracts metrics', async () => {
    const { ContractModel, MaintenanceScheduleModel, ContractEquipmentModel } = await import('../../src/contracts/models/index');

    vi.mocked(ContractModel.countDocuments)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(4);
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(12);
    vi.mocked(ContractEquipmentModel.countDocuments).mockResolvedValue(85);

    const result = await service.getContractsMetrics(TENANT);

    expect(result.activeContracts).toBe(30);
    expect(result.expiringNextMonth).toBe(4);
    expect(result.upcomingMaintenance).toBe(12);
    expect(result.equipmentUnderContract).toBe(85);
  });
});
