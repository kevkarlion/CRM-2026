import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm-2026?appName=Cluster0';

async function main() {
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.client.db('test');
  const col = db.collection('workorders');

  const total = await col.countDocuments({ deletedAt: null });
  console.log('=== TOTAL OTs (no borradas):', total, '===\n');

  // Distribución por status operativo
  console.log('--- Por status (operativo) ---');
  const byStatus = await col.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  byStatus.forEach(r => console.log(`  ${r._id || '(missing)'}: ${r.count}`));

  // Distribución por workStatus
  console.log('\n--- Por workStatus (negocio) ---');
  const byWs = await col.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: '$workStatus', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  byWs.forEach(r => console.log(`  ${r._id || '(missing)'}: ${r.count}`));

  // Matriz cruzada
  console.log('\n--- Matriz status × workStatus ---');
  const matrix = await col.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: { s: '$status', w: '$workStatus' }, count: { $sum: 1 } } },
    { $sort: { '_id.s': 1, '_id.w': 1 } },
  ]).toArray();
  matrix.forEach(r => console.log(`  status=${r._id.s || '(missing)'} | workStatus=${r._id.w || '(missing)'} : ${r.count}`));

  // Inconsistencias específicas
  console.log('\n=== INCONSISTENCIAS ===');
  const cancelledNegocioActivo = await col.countDocuments({ deletedAt: null, workStatus: 'cancelled', status: { $nin: ['cancelled', 'closed', 'completed'] } });
  console.log('workStatus=cancelled pero status NO terminal:', cancelledNegocioActivo);

  const terminalActivo = await col.countDocuments({ deletedAt: null, status: { $in: ['closed', 'completed'] }, workStatus: { $in: ['active', null], $exists: true } });
  console.log('status terminal (closed/completed) pero workStatus active o missing:', terminalActivo);

  const missingWs = await col.countDocuments({ deletedAt: null, workStatus: { $exists: false } });
  console.log('sin campo workStatus:', missingWs);

  const missingStatus = await col.countDocuments({ deletedAt: null, status: { $exists: false } });
  console.log('sin campo status:', missingStatus);

  const legacy = await col.countDocuments({ deletedAt: null, status: { $in: ['pending_assignment', 'confirmed', 'pending', 'accepted', 'paused'] } });
  console.log('status legacy (pending_assignment/confirmed/pending/accepted/paused):', legacy);

  // OTs con workStatus cancelled y status no cancelado: detalle
  console.log('\n--- OTs workStatus=cancelled con status NO terminal (detalle) ---');
  const cancels = await col.find({ deletedAt: null, workStatus: 'cancelled', status: { $nin: ['cancelled', 'closed', 'completed'] } })
    .project({ workOrderNumber: 1, title: 1, status: 1, workStatus: 1, scheduledDate: 1, closedAt: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(30)
    .toArray();
  cancels.forEach(w => console.log(`  ${w.workOrderNumber} | status=${w.status} | ws=${w.workStatus} | fecha=${w.scheduledDate} | upd=${w.updatedAt?.toISOString?.() ?? w.updatedAt}`));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
