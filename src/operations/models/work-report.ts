import mongoose from 'mongoose';
import { workReportSchema } from '../schemas/work-report';
import { IWorkReport } from '../types/work-report';

export const WorkReportModel = mongoose.model<IWorkReport>('WorkReport', workReportSchema);

// Ensure indexes are created correctly (handles duplicate index issue from null workOrderId)
export async function ensureWorkReportIndexes() {
  try {
    // Drop the problematic index if it exists (non-sparse unique index)
    await WorkReportModel.collection.dropIndex('tenantId_1_workOrderId_1').catch(() => {});
    // Recreate with sparse option using collection
    await WorkReportModel.collection.createIndex({ tenantId: 1, workOrderId: 1 }, { sparse: true });
    // Ensure technicalVisitId index is unique and sparse
    await WorkReportModel.collection.dropIndex('tenantId_1_technicalVisitId_1').catch(() => {});
    await WorkReportModel.collection.createIndex({ tenantId: 1, technicalVisitId: 1 }, { unique: true, sparse: true });
  } catch (err) {
    console.error('[WorkReport] Error ensuring indexes:', err);
  }
}

export default WorkReportModel;