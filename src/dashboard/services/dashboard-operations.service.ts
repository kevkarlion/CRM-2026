import mongoose from 'mongoose';
import { WorkOrderModel, WorkOrderAssignmentModel } from '../../operations/models';
import {
  OperationsResponse,
  SLAMetrics,
  TechnicianLoad,
} from '../types/metrics';

export class DashboardOperationsService {
  async getOperationsMetrics(tenantId: string): Promise<OperationsResponse> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      pendingOrders,
      inProgressOrders,
      completedToday,
      upcomingSevenDays,
      sla,
      technicianLoad,
    ] = await Promise.all([
      WorkOrderModel.countDocuments({
        tenantId, deletedAt: null,
        status: { $in: ['draft', 'scheduled', 'confirmed'] },
      }),
      WorkOrderModel.countDocuments({
        tenantId, deletedAt: null,
        status: { $in: ['assigned', 'en_route', 'on_site', 'paused'] },
      }),
      WorkOrderModel.countDocuments({
        tenantId, deletedAt: null,
        status: 'completed',
        updatedAt: { $gte: todayStart, $lt: todayEnd },
      }),
      WorkOrderModel.countDocuments({
        tenantId, deletedAt: null,
        status: { $in: ['scheduled', 'confirmed', 'assigned'] },
        scheduledDate: { $gte: now, $lte: sevenDaysFromNow },
      }),
      this.calculateSLA(tenantId),
      this.getTechnicianLoad(tenantId),
    ]);

    return {
      pendingOrders,
      inProgressOrders,
      completedToday,
      upcomingSevenDays,
      sla,
      technicianLoad,
      generatedAt: now.toISOString(),
    };
  }

  private async calculateSLA(tenantId: string): Promise<SLAMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completed = await WorkOrderModel.find({
      tenantId, deletedAt: null,
      status: 'completed',
      updatedAt: { $gte: thirtyDaysAgo },
    })
      .select('createdAt updatedAt')
      
      .exec();

    let onTime = 0;
    let delayed = 0;
    let totalHours = 0;

    for (const wo of completed) {
      const hours = (wo.updatedAt.getTime() - wo.createdAt.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
      if (hours <= 48) onTime++;
      else delayed++;
    }

    return {
      onTime,
      delayed,
      avgResponseTimeHours: completed.length > 0
        ? Math.round((totalHours / completed.length) * 10) / 10
        : null,
    };
  }

  private async getTechnicianLoad(tenantId: string): Promise<TechnicianLoad[]> {
    const tid = new mongoose.Types.ObjectId(tenantId);
    const assignments = await WorkOrderAssignmentModel.aggregate([
      { $match: { tenantId: tid, unassignedAt: null } },
      {
        $lookup: {
          from: 'users',
          localField: 'technicianId',
          foreignField: '_id',
          as: 'technician',
        },
      },
      { $unwind: '$technician' },
      {
        $group: {
          _id: '$technicianId',
          assignedCount: { $sum: 1 },
          technicianName: { $first: '$technician.firstName' },
          technicianLastName: { $first: '$technician.lastName' },
        },
      },
      { $sort: { assignedCount: -1 } },
      { $limit: 10 },
    ]);
    return assignments.map((a) => ({
      techId: a._id.toString(),
      name: `${a.technicianName || ''} ${a.technicianLastName || ''}`.trim() || 'Unknown',
      assignedCount: a.assignedCount,
    }));
  }
}
