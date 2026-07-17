import { Types } from 'mongoose';
import WorkOrderModel from '../models/work-order';
import WorkOrderAssignmentModel from '../models/work-order-assignment';
import { TechnicianModel } from '../models/technician';
import VisitReportModel from '../models/visit-report';

export interface OperativeDashboardMetrics {
  summary: {
    totalWorkOrders: number;
    pending: number;
    urgent: number;
    overdue: number;
    withoutTechnician: number;
    inExecution: number;
    pendingReport: number;
  };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  todayStarts: number;
  technicians: {
    total: number;
    available: number;
    busy: number;
    unavailable: number;
  };
  nextActions: {
    unassigned: number;
    unscheduled: number;
    pendingApproval: number;
    awaitingExecution: number;
    pendingReport: number;
  };
}

export class OperativeDashboardService {
  /**
   * Get complete operative dashboard metrics
   */
  async getDashboardMetrics(tenantId: string): Promise<OperativeDashboardMetrics> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalWorkOrders,
      byStatus,
      byPriority,
      technicians,
      pendingReports,
      todayStarts,
      activeAssignments,
    ] = await Promise.all([
      // Total work orders
      WorkOrderModel.countDocuments({
        tenantId: tenantObjectId,
        deletedAt: null,
      }),

      // By status
      WorkOrderModel.aggregate([
        { $match: { tenantId: tenantObjectId, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // By priority
      WorkOrderModel.aggregate([
        { $match: { tenantId: tenantObjectId, deletedAt: null } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // Technician stats
      TechnicianModel.aggregate([
        { $match: { tenantId: tenantObjectId, deletedAt: null } },
        { $group: { _id: '$availability', count: { $sum: 1 } } },
      ]),

      // Pending reports (completed but no report)
      WorkOrderModel.countDocuments({
        tenantId: tenantObjectId,
        status: 'completed',
        deletedAt: null,
      }),

      // Work orders starting today
      WorkOrderModel.countDocuments({
        tenantId: tenantObjectId,
        scheduledDate: { $gte: today, $lt: tomorrow },
        deletedAt: null,
      }),

      // Active assignments
      WorkOrderAssignmentModel.countDocuments({
        tenantId: tenantObjectId,
        status: { $in: ['assigned', 'acknowledged'] },
        deletedAt: null,
      }),
    ]);

    // Calculate metrics
    const statusMap = byStatus.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {} as Record<string, number>);
    const priorityMap = byPriority.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {} as Record<string, number>);
    const techMap = technicians.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {} as Record<string, number>);

    const summary = {
      totalWorkOrders,
      pending: (statusMap.draft || 0) + (statusMap.scheduled || 0),
      urgent: priorityMap.urgent + priorityMap.emergency,
      overdue: await this.countOverdue(tenantObjectId),
      withoutTechnician: await this.countWithoutTechnician(tenantObjectId),
      inExecution: (statusMap.assigned || 0) + (statusMap.en_route || 0) + (statusMap.on_site || 0),
      pendingReport: pendingReports,
    };

    const nextActions = {
      unassigned: await this.countUnassigned(tenantObjectId),
      unscheduled: await this.countUnscheduled(tenantObjectId),
      pendingApproval: statusMap.confirmed || 0,
      awaitingExecution: (statusMap.assigned || 0),
      pendingReport: pendingReports,
    };

    return {
      summary,
      byStatus: statusMap,
      byPriority: priorityMap,
      todayStarts,
      technicians: {
        total: Object.values(techMap).reduce((a, b) => (a as number) + (b as number), 0) as number,
        available: (techMap.available as number) || 0,
        busy: (techMap.busy as number) || 0,
        unavailable: (techMap.unavailable as number) || 0,
      },
      nextActions,
    };
  }

  private async countOverdue(tenantId: Types.ObjectId): Promise<number> {
    const now = new Date();
    return WorkOrderModel.countDocuments({
      tenantId,
      status: { $nin: ['completed', 'cancelled', 'closed'] },
      scheduledDate: { $lt: now },
      deletedAt: null,
    });
  }

  private async countWithoutTechnician(tenantId: Types.ObjectId): Promise<number> {
    return WorkOrderModel.countDocuments({
      tenantId,
      status: { $in: ['draft', 'scheduled', 'confirmed'] },
      $or: [
        { assignedTechnicians: { $size: 0 } },
        { assignedTechnicians: { $exists: false } },
      ],
      deletedAt: null,
    });
  }

  private async countUnassigned(tenantId: Types.ObjectId): Promise<number> {
    return WorkOrderModel.countDocuments({
      tenantId,
      status: { $in: ['draft', 'scheduled', 'confirmed'] },
      $or: [
        { assignedTechnicians: { $size: 0 } },
        { assignedTechnicians: { $exists: false } },
      ],
      deletedAt: null,
    });
  }

  private async countUnscheduled(tenantId: Types.ObjectId): Promise<number> {
    return WorkOrderModel.countDocuments({
      tenantId,
      status: { $in: ['draft', 'confirmed'] },
      scheduledDate: null,
      deletedAt: null,
    });
  }

  /**
   * Get technicians with their current workload
   */
  async getTechnicianWorkload(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);

    const technicians = await TechnicianModel.find({
      tenantId: tenantObjectId,
      status: 'active',
      deletedAt: null,
    }).lean();

    const workload = await Promise.all(
      technicians.map(async (tech) => {
        const activeAssignments = await WorkOrderAssignmentModel.countDocuments({
          technicianId: tech._id,
          status: { $in: ['assigned', 'acknowledged'] },
          deletedAt: null,
        });

        const todayAssignments = await WorkOrderAssignmentModel.countDocuments({
          technicianId: tech._id,
          assignedAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          deletedAt: null,
        });

        const completedToday = await WorkOrderModel.countDocuments({
          tenantId: tenantObjectId,
          assignedTechnicians: tech._id,
          status: 'completed',
          updatedAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          deletedAt: null,
        });

        return {
          _id: String(tech._id),
          name: tech.name,
          email: tech.email,
          phone: tech.phone,
          status: tech.status,
          availability: tech.availability,
          specialties: tech.specialties,
          maxDailyWorkOrders: tech.maxDailyWorkOrders,
          activeAssignments,
          todayAssignments,
          completedToday,
          utilization: tech.maxDailyWorkOrders > 0 
            ? Math.round((todayAssignments / tech.maxDailyWorkOrders) * 100) 
            : 0,
        };
      })
    );

    return workload;
  }

  /**
   * Get agenda view (calendar data)
   */
  async getAgenda(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);

    const workOrders = await WorkOrderModel.find({
      tenantId: tenantObjectId,
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'closed'] },
      deletedAt: null,
    })
      .populate('assignedTechnicians', 'name email phone')
      .lean();

    return workOrders.map(wo => ({
      _id: String(wo._id),
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      scheduledDate: wo.scheduledDate,
      scheduledStart: wo.scheduledStart,
      scheduledEnd: wo.scheduledEnd,
      clientSnapshot: wo.clientSnapshot,
      locationSnapshot: wo.locationSnapshot,
      technicians: wo.assignedTechnicians?.map((t: any) => ({
        _id: String(t._id),
        name: t.name,
        email: t.email,
        phone: t.phone,
      })) || [],
    }));
  }
}

export const operativeDashboardService = new OperativeDashboardService();