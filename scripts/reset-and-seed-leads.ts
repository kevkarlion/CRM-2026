/**
 * Reset & Seed Leads
 * ------------------
 * 1. Deletes ALL leads + related entities (activities, quotes, work orders,
 *    technical visits, negotiations, clients linked to leads)
 * 2. Creates 40 new leads with status "contacted"
 *
 * Usage:  npx tsx scripts/reset-and-seed-leads.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

const NAMES = [
  'María García', 'Juan Pérez', 'Carlos López', 'Ana Martínez', 'Lucía Fernández',
  'Pedro Sánchez', 'Laura Rodríguez', 'Diego Gómez', 'Valentina Díaz', 'Martín Ruiz',
  'Sofía Álvarez', 'Facundo Moreno', 'Camila Sosa', 'Lautaro Medina', 'Florencia Ortiz',
  'Tomás Castillo', 'Emilia Torres', 'Nicolás Ramos', 'Isabella Acosta', 'Mateo Herrera',
  'Catalina Pereyra', 'Sebastián Navarro', 'Victoria Vega', 'Benjamín Rivas', 'Julieta Campos',
  'Joaquín Molina', 'Antonella Quiroga', 'Santiago Ferreyra', 'Agustina Córdoba', 'Bruno Miranda',
  'Guadalupe Ibáñez', 'Thiago Luna', 'Luciana Páez', 'Franco Godoy', 'Rocío Cáceres',
  'Ian Aguirre', 'Martina Duarte', 'Emiliano Farías', 'Alma Bustos', 'Bautista Correa',
];

const COMPANIES = [
  'Restaurant El Gaucho', 'Farmacia San Jorge', 'Gimnasio Fitmax', 'Colegio San Patricio',
  'Oficinas del Centro', 'Clínica Privada Norte', 'Hotel Suites Premium', 'Supermercado Don José',
  'Panadería La Central', 'Peluquería Studio 54', 'Taller Mecánico El Rápido', 'Bazar Todo x $2',
  'Inmobiliaria del Sur', 'Estudio Jurídico Pérez', 'Consultora MGMT', 'Transporte Rápido SRL',
  'Lavadero Automático', 'Veterinaria San Roque', 'Heladería Copelia', 'Kiosco 24hs',
  'Ferretería El Tornillo', 'Cafetería La Bohemia', 'Pizzería Nápoli', 'Electricidad del Oeste',
  'Cerrajería 24hs', 'Clínica Dental Care', 'Óptica Visión', 'Librería El Ateneo',
  'Verdulería Doña Rosa', 'Carnicería El Abasto', 'Remisería Veloz', 'Almacén El Progreso',
  'Barbería Don Juan', 'Jardín Maternal Peques', 'Pinturería Colorín', 'Mueblería El Hogar',
  'Bicicletería Rush', 'Gomería El Chapa', 'Serigrafía Print', 'Rotisería La Abuela',
];

const SOURCES = ['whatsapp', 'call', 'form', 'referral', 'walk_in'] as const;

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  const area = Math.floor(Math.random() * 600) + 200;
  const num = Math.floor(Math.random() * 9000000) + 1000000;
  return `11-${area}-${num}`;
}

function randomEmail(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.com.ar', 'outlook.com', 'empresa.com.ar'];
  return `${slug}@${randomPick(domains)}`;
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.floor(Math.random() * daysBack * 86400000));
}

async function main() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI no está definido en .env.local');
    process.exit(1);
  }

  console.log('Conectando a MongoDB…');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log('Conectado.\n');

  // ── 1. CLEANUP ──────────────────────────────────────
  console.log('=== LIMPIEZA ===');

  const collectionsToClean = [
    { name: 'activities', desc: 'Actividades' },
    { name: 'leads', desc: 'Leads' },
    { name: 'leadassignments', desc: 'Asignaciones de leads' },
    { name: 'quotes', desc: 'Presupuestos' },
    { name: 'quoteversions', desc: 'Versiones de presupuestos' },
    { name: 'workorders', desc: 'Órdenes de trabajo' },
    { name: 'workorderevents', desc: 'Eventos de OT' },
    { name: 'workorderassignments', desc: 'Asignaciones de OT' },
    { name: 'technicalvisits', desc: 'Visitas técnicas' },
    { name: 'visitreports', desc: 'Reportes de visita' },
    { name: 'previsitchecklists', desc: 'Checklists pre-visita' },
    { name: 'negotiations', desc: 'Negociaciones' },
    { name: 'negotiationevents', desc: 'Eventos de negociación' },
    { name: 'clients', desc: 'Clientes' },
    { name: 'locations', desc: 'Ubicaciones' },
    { name: 'equipments', desc: 'Equipamientos' },
    { name: 'contracts', desc: 'Contratos' },
    { name: 'servicehistories', desc: 'Historial de servicio' },
    { name: 'attachments', desc: 'Adjuntos' },
    { name: 'tasks', desc: 'Tareas' },
  ];

  for (const col of collectionsToClean) {
    const result = await db.collection(col.name).deleteMany({});
    console.log(`  ${col.desc}: ${result.deletedCount} eliminados`);
  }

  // Reset work order counters
  await db.collection('workordercounters').deleteMany({});
  console.log('  Contadores OT: reseteados');

  console.log('\n=== SEED ===');

  // ── 2. FIND TENANT & USERS ──────────────────────────
  const tenant = await db.collection('tenants').findOne({ deletedAt: null });
  if (!tenant) {
    console.error('No hay tenants en la base de datos.');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.name} (${tenantId})`);

  const users = await db.collection('users').find({ tenantId, deletedAt: null }).toArray();
  if (users.length === 0) {
    console.error('No hay usuarios para este tenant.');
    process.exit(1);
  }
  console.log(`Usuarios disponibles: ${users.length}`);

  // ── 3. CREATE 40 CONTACTED LEADS ────────────────────
  const leads = NAMES.map((name, i) => {
    const user = randomPick(users);
    const companyName = COMPANIES[i % COMPANIES.length];

    return {
      tenantId,
      name,
      companyName,
      email: randomEmail(name),
      phone: randomPhone(),
      source: randomPick(SOURCES),
      status: 'contacted',
      qualificationStatus: 'pending',
      assignedTo: user._id,
      notes: `Lead generado automáticamente — contacted`,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      deletedAt: null,
      createdAt: randomDate(30),
      updatedAt: new Date(),
    };
  });

  const result = await db.collection('leads').insertMany(leads);
  console.log(`\nLeads creados: ${result.insertedCount}`);

  // Summary
  const byStatus = await db.collection('leads').aggregate([
    { $match: { tenantId, deletedAt: null } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log('\nDistribución por status:');
  for (const s of byStatus) {
    console.log(`  ${s._id}: ${s.count}`);
  }

  console.log('\n✅ Listo! Base de datos reseteada y 40 leads "contacted" creados.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
