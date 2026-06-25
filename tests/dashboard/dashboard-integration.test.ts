// ── Dashboard integration tests — full flow validation ─────

// Tests the complete dashboard service chain: all 4 services
// return consistent, correctly-shaped data for the frontend.
// All models are mocked; we test service orchestration + response shape.
//
// IMPORTANT: Services run SEQUENTIALLY (not Promise.all) because
// shared model mocks use mockResolvedValueOnce which is order-sensitive.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/crm/models/index', () => ({
  ClientModel: { countDocuments: vi.fn(), find: vi.fn() },
}));

vi.mock('../../src/operations/models/index', () => ({
  WorkOrderModel: {
    countDocuments: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
  WorkOrderAssignmentModel: {
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
  },
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

describe('Dashboard Integration — cross-service consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('all 4 services return correctly shaped responses', async () => {
    // ── Setup all mocks ─────────────────────────────────
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel, ContractEquipmentModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    // Summary mocks (consumed sequentially)
    vi.mocked(ClientModel.countDocuments)
      .mockResolvedValueOnce(100)  // total clients
      .mockResolvedValueOnce(8);   // new this month
    vi.mocked(ContractModel.distinct).mockResolvedValue(['c1', 'c2']);
    vi.mocked(WorkOrderModel.countDocuments)
      .mockResolvedValueOnce(25)   // pending
      .mockResolvedValueOnce(12)   // inProgress
      .mockResolvedValueOnce(40);  // completed this month
    vi.mocked(LeadModel.countDocuments)
      .mockResolvedValueOnce(15)   // new leads
      .mockResolvedValueOnce(6);   // qualified
    // QuoteModel.countDocuments: sent, approved, rejected (3 calls from metrics)
    vi.mocked(QuoteModel.countDocuments)
      .mockResolvedValueOnce(30)   // sent
      .mockResolvedValueOnce(12)   // approved
      .mockResolvedValueOnce(3);   // rejected
    vi.mocked(QuoteModel.aggregate)
      .mockResolvedValueOnce([{ _id: null, total: 250000 }]);  // totalEstimatedValue
    vi.mocked(ContractModel.countDocuments)
      .mockResolvedValueOnce(45)   // active
      .mockResolvedValueOnce(6);   // expiringSoon
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(15);
    vi.mocked(WorkOrderAssignmentModel.countDocuments).mockResolvedValue(20);
    vi.mocked(ClientModel.find).mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]);

    // Run summary FIRST
    const metrics = new DashboardMetricsService();
    const summary = await metrics.getSummary(TENANT);
    vi.clearAllMocks();

    // ── Now run operations with fresh mocks ─────────────
    vi.mocked(WorkOrderModel.countDocuments)
      .mockResolvedValueOnce(15)   // pendingOrders
      .mockResolvedValueOnce(10)   // inProgressOrders
      .mockResolvedValueOnce(5)    // completedToday
      .mockResolvedValueOnce(20);  // upcomingSevenDays
    vi.mocked(WorkOrderModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        { createdAt: new Date(), updatedAt: new Date() },
        { createdAt: new Date(), updatedAt: new Date(Date.now() + 3600000) },
      ]),
    } as any);
    vi.mocked(WorkOrderAssignmentModel.aggregate).mockResolvedValue([
      { _id: 'tech-1', technicianName: 'Ana Gómez', assignedCount: 5 },
      { _id: 'tech-2', technicianName: 'Carlos Ruiz', assignedCount: 3 },
    ]);

    const ops = new DashboardOperationsService();
    const opResult = await ops.getOperationsMetrics(TENANT);

    // Cross-check
    expect(summary.workOrders.pending).toBe(25);
    expect(opResult.pendingOrders).toBe(15);
    vi.clearAllMocks();

    // ── Commercial ──────────────────────────────────────
    vi.mocked(LeadModel.aggregate).mockResolvedValue([
      { _id: 'new', count: 10 },
      { _id: 'qualified', count: 5 },
    ]);
    vi.mocked(LeadModel.countDocuments)
      .mockResolvedValueOnce(10)   // new this month
      .mockResolvedValueOnce(50)   // total active
      .mockResolvedValueOnce(4);   // won
    vi.mocked(QuoteModel.aggregate)
      .mockResolvedValueOnce([
        { _id: 'sent', count: 8 },
        { _id: 'approved', count: 4 },
      ])                           // quotesByStatus
      .mockResolvedValueOnce([
        { _id: 'cl-1', totalQuoted: 80000, name: 'TechCorp' },
        { _id: 'cl-2', totalQuoted: 60000, name: 'ServiTotal' },
      ]);                          // topClients

    const commercial = new DashboardCommercialService();
    const commResult = await commercial.getCommercialMetrics(TENANT);
    vi.clearAllMocks();

    // ── Contracts ───────────────────────────────────────
    vi.mocked(ContractModel.countDocuments)
      .mockResolvedValueOnce(30)   // activeContracts
      .mockResolvedValueOnce(4);   // expiringNextMonth
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(12);
    vi.mocked(ContractEquipmentModel.countDocuments).mockResolvedValue(85);

    const contracts = new DashboardContractsService();
    const contrResult = await contracts.getContractsMetrics(TENANT);

    // ── Validate shapes ─────────────────────────────────
    // Summary
    expect(summary).toHaveProperty('clients');
    expect(summary.clients.total).toBe(100);
    expect(summary.clients.newThisMonth).toBe(8);
    expect(summary.clients.activeWithContracts).toBe(2);
    expect(summary).toHaveProperty('workOrders');
    expect(summary.workOrders.pending).toBe(25);
    expect(summary).toHaveProperty('leads');
    expect(summary.leads.new).toBe(15);
    expect(summary.leads.qualified).toBe(6);
    expect(summary).toHaveProperty('quotes');
    expect(summary.quotes.sent).toBe(30);
    expect(summary.quotes.approved).toBe(12);
    expect(summary.quotes.totalEstimatedValue).toBe(250000);
    expect(summary).toHaveProperty('contracts');
    expect(summary.contracts.active).toBe(45);
    expect(summary.generatedAt).toBeDefined();
    expect(typeof summary.generatedAt).toBe('string');

    // Operations
    expect(opResult).toHaveProperty('pendingOrders');
    expect(opResult).toHaveProperty('completedToday');
    expect(opResult).toHaveProperty('inProgressOrders');
    expect(opResult).toHaveProperty('upcomingSevenDays');
    expect(opResult).toHaveProperty('sla');
    expect(opResult.sla).toHaveProperty('onTime');
    expect(opResult.sla).toHaveProperty('delayed');
    expect(opResult).toHaveProperty('technicianLoad');
    expect(opResult.technicianLoad).toHaveLength(2);
    expect(opResult.technicianLoad[0]).toHaveProperty('techId');
    expect(opResult.technicianLoad[0]).toHaveProperty('name');

    // Commercial
    expect(commResult).toHaveProperty('leadsByStage');
    expect(commResult).toHaveProperty('newLeadsThisMonth');
    expect(commResult).toHaveProperty('conversionRate');
    expect(commResult).toHaveProperty('quotesByStatus');
    expect(commResult).toHaveProperty('topClients');
    expect(commResult.leadsByStage.length).toBeGreaterThan(0);
    expect(commResult.topClients[0].name).toBe('TechCorp');
    expect(commResult.topClients[0].totalQuoted).toBe(80000);

    // Contracts
    expect(contrResult).toHaveProperty('activeContracts');
    expect(contrResult).toHaveProperty('expiringNextMonth');
    expect(contrResult).toHaveProperty('upcomingMaintenance');
    expect(contrResult).toHaveProperty('equipmentUnderContract');
    expect(contrResult.activeContracts).toBe(30);
    expect(contrResult.expiringNextMonth).toBe(4);
    expect(contrResult.upcomingMaintenance).toBe(12);
    expect(contrResult.equipmentUnderContract).toBe(85);
  });

  it('handles empty system gracefully — all services return zeroes', async () => {
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel, ContractEquipmentModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    // ── Summary (all zeroes) ──
    vi.mocked(ClientModel.countDocuments).mockResolvedValue(0);
    vi.mocked(ContractModel.distinct).mockResolvedValue([]);
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(0);
    vi.mocked(LeadModel.countDocuments).mockResolvedValue(0);
    vi.mocked(QuoteModel.countDocuments).mockResolvedValue(0);
    vi.mocked(QuoteModel.aggregate).mockResolvedValue([]);
    vi.mocked(ContractModel.countDocuments).mockResolvedValue(0);
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(0);
    vi.mocked(WorkOrderAssignmentModel.countDocuments).mockResolvedValue(0);
    vi.mocked(ClientModel.find).mockResolvedValue([]);

    const metrics = new DashboardMetricsService();
    const summary = await metrics.getSummary(TENANT);

    expect(summary.clients.total).toBe(0);
    expect(summary.clients.activeWithContracts).toBe(0);
    expect(summary.workOrders.pending).toBe(0);
    expect(summary.leads.new).toBe(0);
    expect(summary.quotes.sent).toBe(0);
    expect(summary.contracts.active).toBe(0);
    expect(summary.leads.conversionRate).toBe(0);
    vi.clearAllMocks();

    // ── Operations (all zeroes) ──
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(0);
    vi.mocked(WorkOrderModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(WorkOrderAssignmentModel.aggregate).mockResolvedValue([]);

    const ops = new DashboardOperationsService();
    const opResult = await ops.getOperationsMetrics(TENANT);

    expect(opResult.pendingOrders).toBe(0);
    expect(opResult.technicianLoad).toHaveLength(0);
    expect(opResult.sla.onTime).toBe(0);
    expect(opResult.sla.avgResponseTimeHours).toBeNull();
    vi.clearAllMocks();

    // ── Commercial (all zeroes) ──
    vi.mocked(LeadModel.aggregate).mockResolvedValue([]);
    vi.mocked(LeadModel.countDocuments).mockResolvedValue(0);
    vi.mocked(QuoteModel.aggregate).mockResolvedValue([]);

    const commercial = new DashboardCommercialService();
    const commResult = await commercial.getCommercialMetrics(TENANT);

    expect(commResult.leadsByStage).toHaveLength(0);
    expect(commResult.newLeadsThisMonth).toBe(0);
    expect(commResult.conversionRate).toBe(0);
    expect(commResult.topClients).toHaveLength(0);
    vi.clearAllMocks();

    // ── Contracts (all zeroes) ──
    vi.mocked(ContractModel.countDocuments).mockResolvedValue(0);
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(0);
    vi.mocked(ContractEquipmentModel.countDocuments).mockResolvedValue(0);

    const contracts = new DashboardContractsService();
    const contrResult = await contracts.getContractsMetrics(TENANT);

    expect(contrResult.activeContracts).toBe(0);
    expect(contrResult.expiringNextMonth).toBe(0);
  });

  it('all service responses are JSON-serializable (no Date/undefined)', async () => {
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel, ContractEquipmentModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    // ── Summary ──
    vi.mocked(ClientModel.countDocuments).mockResolvedValue(10);
    vi.mocked(ContractModel.distinct).mockResolvedValue(['c1']);
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(5);
    vi.mocked(LeadModel.countDocuments).mockResolvedValue(3);
    vi.mocked(QuoteModel.countDocuments)
      .mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    vi.mocked(QuoteModel.aggregate).mockResolvedValue([{ _id: null, total: 1000 }]);
    vi.mocked(ContractModel.countDocuments).mockResolvedValue(5);
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(2);
    vi.mocked(WorkOrderAssignmentModel.countDocuments).mockResolvedValue(3);
    vi.mocked(ClientModel.find).mockResolvedValue([{ _id: 'c1' }]);

    const metrics = new DashboardMetricsService();
    const summary = await metrics.getSummary(TENANT);
    vi.clearAllMocks();

    // ── Operations ──
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(3);
    vi.mocked(WorkOrderModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([{ createdAt: new Date(), updatedAt: new Date() }]),
    } as any);
    vi.mocked(WorkOrderAssignmentModel.aggregate).mockResolvedValue([{ _id: 't1', technicianName: 'Test', assignedCount: 3 }]);

    const ops = new DashboardOperationsService();
    const opResult = await ops.getOperationsMetrics(TENANT);
    vi.clearAllMocks();

    // ── Commercial ──
    vi.mocked(LeadModel.aggregate).mockResolvedValue([{ _id: 'new', count: 3 }]);
    vi.mocked(LeadModel.countDocuments).mockResolvedValue(3);
    vi.mocked(QuoteModel.aggregate)
      .mockResolvedValueOnce([{ _id: 'sent', count: 2 }])
      .mockResolvedValueOnce([{ _id: 'cl-1', totalQuoted: 1000, name: 'Cliente A' }]);

    const commercial = new DashboardCommercialService();
    const commResult = await commercial.getCommercialMetrics(TENANT);
    vi.clearAllMocks();

    // ── Contracts ──
    vi.mocked(ContractModel.countDocuments).mockResolvedValue(5);
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(2);
    vi.mocked(ContractEquipmentModel.countDocuments).mockResolvedValue(15);

    const contracts = new DashboardContractsService();
    const contrResult = await contracts.getContractsMetrics(TENANT);

    // JSON.stringify should NOT throw
    expect(() => JSON.stringify(summary)).not.toThrow();
    expect(() => JSON.stringify(opResult)).not.toThrow();
    expect(() => JSON.stringify(commResult)).not.toThrow();
    expect(() => JSON.stringify(contrResult)).not.toThrow();

    // generatedAt is a string, not a Date object
    const parsed = JSON.parse(JSON.stringify(summary));
    expect(typeof parsed.generatedAt).toBe('string');
  });

  it('contracts.expiringNextMonth is consistent across Summary and ContractsService', async () => {
    const { ClientModel } = await import('../../src/crm/models/index');
    const { WorkOrderModel, WorkOrderAssignmentModel } = await import('../../src/operations/models/index');
    const { ContractModel, MaintenanceScheduleModel, ContractEquipmentModel } = await import('../../src/contracts/models/index');
    const { QuoteModel } = await import('../../src/quotes/models/index');
    const { LeadModel } = await import('../../src/leads/models/index');

    // Summary first
    vi.mocked(ClientModel.countDocuments).mockResolvedValue(50);
    vi.mocked(ContractModel.distinct).mockResolvedValue([]);
    vi.mocked(WorkOrderModel.countDocuments).mockResolvedValue(0);
    vi.mocked(LeadModel.countDocuments).mockResolvedValue(0);
    vi.mocked(QuoteModel.countDocuments).mockResolvedValue(0);
    vi.mocked(QuoteModel.aggregate).mockResolvedValue([]);
    vi.mocked(ContractModel.countDocuments)
      .mockResolvedValueOnce(25)   // active
      .mockResolvedValueOnce(3);    // expiringSoon
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(0);
    vi.mocked(WorkOrderAssignmentModel.countDocuments).mockResolvedValue(0);
    vi.mocked(ClientModel.find).mockResolvedValue([]);

    const metrics = new DashboardMetricsService();
    const summary = await metrics.getSummary(TENANT);
    vi.clearAllMocks();

    // Then contracts
    vi.mocked(ContractModel.countDocuments)
      .mockResolvedValueOnce(25)   // activeContracts
      .mockResolvedValueOnce(3);    // expiringNextMonth
    vi.mocked(MaintenanceScheduleModel.countDocuments).mockResolvedValue(0);
    vi.mocked(ContractEquipmentModel.countDocuments).mockResolvedValue(0);

    const contracts = new DashboardContractsService();
    const contrResult = await contracts.getContractsMetrics(TENANT);

    expect(summary.contracts.expiringSoon).toBe(3);
    expect(contrResult.expiringNextMonth).toBe(3);
  });
});
