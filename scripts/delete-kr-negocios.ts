// SOFT-DELETE de TODAS las OTs de "KR Negocios Digitales".
// NO borra físicamente: setea deletedAt + deletedBy (key del esquema workorder).
// FASE DRY: --dry (default) imprime el plan y NO modifica.
// FASE REAL: --real --confirm aplica el soft-delete SIN prompt interactivo.
//            (NO se aplica si --confirm está ausente.)
// Uso: npx tsx scripts/delete-kr-negocios.ts --dry [userId]
//      npx tsx scripts/delete-kr-negocios.ts --real --confirm [userId]
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm2026';
const TERM = 'KR NEGOCIOS DIGITALES';
const args = process.argv.slice(2);
const isReal = args.includes('--real');
const hasConfirm = args.includes('--confirm');
const userIdArg = args.find((a) => !a.startsWith('--'));

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const workorders = db.collection('workorders');
  const users = db.collection('users');

  // Resolver deletedBy: userIdArg (ObjectId suelto) -> si parece un email, buscarlo
  let userId: mongoose.Types.ObjectId | null = null;
  if (userIdArg) {
    if (userIdArg.includes('@')) {
      const u = await users.findOne({ email: userIdArg });
      if (u) userId = u._id;
      else { console.error(`❌ Usuario no encontrado por email: ${userIdArg}`); process.exit(1); }
    } else {
      try { userId = new mongoose.Types.ObjectId(userIdArg); }
      catch { console.error('❌ userId inválido'); process.exit(1); }
    }
  }

  // Clientes match (case-insensitive)
  const clients = await db.collection('clients').find({
    $or: [
      { fullName: { $regex: new RegExp(TERM, 'i') } },
      { companyName: { $regex: new RegExp(TERM, 'i') } },
    ],
    deletedAt: null,
  }).toArray();

  const clientIds = clients.map((c) => c._id);
  const bySnapshot = await workorders.find({
    'clientSnapshot.name': { $regex: new RegExp(TERM, 'i') },
  }).toArray();
  const byClientId = clientIds.length
    ? await workorders.find({ clientId: { $in: clientIds } }).toArray()
    : [];

  const merged = new Map<string, any>();
  bySnapshot.forEach((wo) => merged.set(String(wo._id), wo));
  byClientId.forEach((wo) => merged.set(String(wo._id), wo));
  const docs = Array.from(merged.values());

  console.log(`=== PLAN: ${docs.length} OTs a soft-delete (${isReal ? 'FASE REAL' : 'FASE DRY (sin cambios)'}) ===`);
  docs.forEach((wo) => {
    console.log(`  - ${wo.workOrderNumber} | ${wo.title} | status=${wo.status} | source=${wo.source} | scheduled=${wo.scheduledDate ?? '-'} | deleted=${wo.deletedAt ?? 'NO'}`);
  });

  if (!isReal) {
    console.log('\n(FASE DRY: nada modificado. Re-ejecuta con --real para aplicar.)');
    await mongoose.disconnect();
    return;
  }

  if (docs.length === 0) {
    console.log('Nada que borrar.');
    await mongoose.disconnect();
    return;
  }

  if (!userId) {
    console.error('\n❌ Falta deletedBy. Pasá tu userId o email, o ejecutá sin --real para solo ver.');
    process.exit(1);
  }

  if (!hasConfirm) {
    console.error('\n❌ Fase real sin --confirm. NO se aplicó nada. Re-ejecutá con: --real --confirm <userId|email>');
    await mongoose.disconnect();
    process.exit(1);
  }

  const ids = docs.map((wo) => wo._id);
  const now = new Date();
  const res = await workorders.updateMany(
    { _id: { $in: ids } },
    { $set: { deletedAt: now, deletedBy: userId } },
  );
  console.log(`\n✅ Soft-delete aplicado: matched=${res.matchedCount}, modified=${res.modifiedCount}`);
  console.log(`deletedAt=${now.toISOString()} deletedBy=${userId}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
