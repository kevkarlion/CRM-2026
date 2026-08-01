import mongoose from 'mongoose';
import { workReportSchema } from '../schemas/work-report';
import { IWorkReport } from '../types/work-report';

export const WorkReportModel = mongoose.model<IWorkReport>('WorkReport', workReportSchema);

// Ensure indexes are created correctly (handles duplicate index issue from null workOrderId)
export async function ensureWorkReportIndexes() {
  try {
    // Drop the problematic indexes if they exist
    await WorkReportModel.collection.dropIndex('tenantId_1_workOrderId_1').catch(() => {});
    await WorkReportModel.collection.dropIndex('tenantId_1_technicalVisitId_1').catch(() => {});
    
    // Recreate with sparse option (simpler approach)
    await WorkReportModel.collection.createIndex({ tenantId: 1, workOrderId: 1 }, { sparse: true });
    await WorkReportModel.collection.createIndex({ tenantId: 1, technicalVisitId: 1 }, { sparse: true });
  } catch (err) {
    console.error('[WorkReport] Error ensuring indexes:', err);
  }
}

export default WorkReportModel;