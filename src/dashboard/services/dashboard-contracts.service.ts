import { ContractModel, ContractEquipmentModel, MaintenanceScheduleModel } from '../../contracts/models';
import { ContractsResponse } from '../types/metrics';

export class DashboardContractsService {
  async getContractsMetrics(tenantId: string): Promise<ContractsResponse> {
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const [
      activeContracts,
      expiringNextMonth,
      upcomingMaintenance,
      equipmentUnderContract,
    ] = await Promise.all([
      ContractModel.countDocuments({ tenantId, deletedAt: null, status: 'active' }),
      ContractModel.countDocuments({
        tenantId, deletedAt: null,
        status: 'active',
        endDate: { $lte: nextMonth },
      }),
      MaintenanceScheduleModel.countDocuments({
        tenantId,
        status: 'scheduled',
        scheduledDate: { $gte: now },
      }),
      ContractEquipmentModel.countDocuments({ tenantId, removedAt: null }),
    ]);

    return {
      activeContracts,
      expiringNextMonth,
      upcomingMaintenance,
      equipmentUnderContract,
      generatedAt: now.toISOString(),
    };
  }
}
