import mongoose from 'mongoose';

/**
 * Borra órdenes de trabajo (OT) por número.
 *
 * Uso (desde la raíz del repo, con tsx):
 *   npx tsx scripts/delete-work-order.ts <trozofiltro> [--execute]
 *
 * - Sin --execute → modo DRY: solo lista las OTs que coincidirían (no borra nada).
 * - Con   --execute → borra de verdad la(s) OT(s) coincidentes + sus
 *   workorderassignments y workorderevents.
 *
 * El filtro es una coincidencia PARCIAL (substring) sobre workOrderNumber:
 *   npx tsx scripts/delete-work-order.ts "20260902-0001"     → esa OT exacta
 *   npx tsx scripts/delete-work-order.ts "0002"              → cualquiera que termine en -0002
 *   npx tsx scripts/delete-work-order.ts "bf0e72-20260901"   → todas las del día del tenant
 *
 * IMPORTANTE: ver si la OT entre comillas es la correcta. En DRY verás la lista
 * antes de borrar.
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

interface WorkOrderDoc {
  _id: mongoose.Types.ObjectId;
  workOrderNumber: string;
  title?: string;
  status?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const execIdx = args.indexOf('--execute');
  const execute = execIdx !== -1;
  if (execIdx !== -1) args.splice(execIdx, 1);
  const filter = args.join(' ').trim();

  if (!filter) {
    console.error(
      'Uso: npx tsx scripts/delete-work-order.ts <filtro> [--execute]\n' +
        '  Sin --execute corre en DRY (solo muestra).\n' +
        '  El filtro es un trozo del número de OT, ej: "20260902-0001" o "0002".'
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Buscar OTs por substring en workOrderNumber
  const regex = new RegExp(mongoose.escapeRegExp?.(filter) ?? filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const orders = (await db
    .collection('workorders')
    .find({ workOrderNumber: { $regex: regex } })
    .project({ workOrderNumber: 1, title: 1, status: 1 })
    .toArray()) as unknown as WorkOrderDoc[];

  if (orders.length === 0) {
    console.log('No se encontraron OTs que coincidan con:', filter);
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCoinciden ${orders.length} OT(s):\n`);
  const ids: mongoose.Types.ObjectId[] = [];
  for (const o of orders) {
    ids.push(o._id);
    console.log(`  - [${o.status ?? '?'}] ${o.workOrderNumber}  |  ${o.title ?? ''}`);
  }

  if (!execute) {
    console.log('\n[DRY] No se borró nada. Corré con --execute para borrar.');
    await mongoose.disconnect();
    return;
  }

  const oidObjs = ids.map((id) => new mongoose.Types.ObjectId(String(id)));

  const delOrder = await db.collection('workorders').deleteMany({ _id: { $in: oidObjs } });
  const delAssign = await db.collection('workorderassignments').deleteMany({ workOrderId: { $in: oidObjs } });
  const delEvents = await db.collection('workorderevents').deleteMany({ workOrderId: { $in: oidObjs } });

  console.log('\nBorrado:');
  console.log(`  workorders             -> ${delOrder.deletedCount}`);
  console.log(`  workorderassignments   -> ${delAssign.deletedCount}`);
  console.log(`  workorderevents        -> ${delEvents.deletedCount}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
