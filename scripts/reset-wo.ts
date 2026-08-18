// Reset work order for testing
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-2026';

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  const WorkOrder = mongoose.models.WorkOrder || mongoose.model('WorkOrder', new mongoose.Schema({}, { strict: false }), 'workorders');
  const WorkOrderAssignment = mongoose.models.WorkOrderAssignment || mongoose.model('WorkOrderAssignment', new mongoose.Schema({}, { strict: false }), 'workorderassignments');
  
  const wo = await (WorkOrder as any).findOne({ workOrderNumber: '18-0011' });
  
  if (!wo) {
    console.log('Work order not found');
    await mongoose.disconnect();
    process.exit(0);
  }
  
  console.log('Before:', wo.status, 'startedAt:', wo.startedAt, 'finishedAt:', wo.finishedAt);
  
  // Reset work order
  await (WorkOrder as any).findByIdAndUpdate(wo._id, {
    $set: {
      status: 'scheduled',
      startedAt: null,
      finishedAt: null,
      closedAt: null,
      duration: null,
      workReportId: null,
      updatedAt: new Date()
    }
  });
  
  console.log('Work order reset to scheduled!');
  
  // Also reset assignment status
  await (WorkOrderAssignment as any).updateMany(
    { workOrderId: wo._id },
    { $set: { status: 'scheduled' } }
  );
  
  console.log('Assignment status reset to scheduled');
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });