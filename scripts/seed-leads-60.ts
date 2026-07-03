import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
import { TenantModel } from '../src/core/models';
import { UserModel } from '../src/core/models';
import { LeadModel } from '../src/leads/models';
import type { LeadStatus, LostReason } from '../src/leads/types/lead';

// ── Data ──────────────────────────────────────────────

const NAMES = [
  'María García', 'Juan Pérez', 'Carlos López', 'Ana Martínez', 'Lucía Fernández',
  'Pedro Sánchez', 'Laura Rodríguez', 'Diego Gómez', 'Valentina Díaz', 'Martín Ruiz',
  'Sofía Álvarez', 'Facundo Moreno', 'Camila Sosa', 'Lautaro Medina', 'Florencia Ortiz',
  'Tomás Castillo', 'Emilia Torres', 'Nicolás Ramos', 'Isabella Acosta', 'Mateo Herrera',
  'Catalina Pereyra', 'Sebastián Navarro', 'Victoria Vega', 'Benjamín Rivas', 'Julieta Campos',
  'Joaquín Molina', 'Antonella Quiroga', 'Santiago Ferreyra', 'Agustina Córdoba', 'Bruno Miranda',
  'Guadalupe Ibáñez', 'Thiago Luna', 'Luciana Páez', 'Franco Godoy', 'Rocío Cáceres',
  'Ian Aguirre', 'Martina Duarte', 'Emiliano Farías', 'Alma Bustos', 'Bautista Correa',
  'Josefina Arias', 'Santino Bravo', 'Pilar Loyola', 'Matías Guerra', 'Lourdes Pereyra',
  'Felipe Roldán', 'Malena Vargas', 'Julián Paz', 'Evelyn Ríos', 'Leandro Suárez',
  'Brenda Ponce', 'Maximiliano Casas', 'Selene Velázquez', 'Kevin Roldán', 'Daniela Rivas',
  'Alan Rosales', 'Tamara Maidana', 'Gastón Benítez', 'Aylén Acuña', 'Ezequiel Agüero',
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
  'Sede Central TechCorp', 'Planta Sur Servicios', 'Depósito Central', 'Local Comercial Microcentro',
  'Oficina de Ventas Norte', 'Taller Centralizado', 'Sucursal Caballito', 'Depósito Zona Oeste',
  'Local Once', 'Showroom Palermo', 'Oficinas Belgrano', 'Depósito Avellaneda',
  'Casa Matriz', 'Anexo Centro', 'Punto de Venta Flores', 'Depósito Logística Sur',
  'Local Comercial Centro', 'Oficinas Puerto Madero', 'Showroom Norte', 'Sucursal Recoleta',
];

const SOURCES = ['whatsapp', 'call', 'form', 'referral', 'walk_in'] as const;
const LOST_REASONS: LostReason[] = ['price', 'competitor', 'budget', 'not_interested', 'timing', 'no_response'];

/**
 * Distribution of 60 leads across pipeline stages.
 * Calificados = technical_visit, quote_sent, negotiation, won.
 */
const STATUS_DISTRIBUTION: LeadStatus[] = [
  // Nuevos
  ...Array(15).fill('new'),
  // Contactados
  ...Array(12).fill('contacted'),
  // Calificados — Visita técnica
  ...Array(8).fill('technical_visit'),
  // Calificados — Presupuesto enviado
  ...Array(10).fill('quote_sent'),
  // Calificados — Negociación
  ...Array(8).fill('negotiation'),
  // Ganados
  ...Array(4).fill('won'),
  // Perdidos
  ...Array(3).fill('lost'),
] as const;

// ── Helpers ───────────────────────────────────────────

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

function estimatedValue(status: LeadStatus): number | undefined {
  if (['new', 'contacted', 'lost'].includes(status)) return undefined;
  const vals = [120000, 180000, 250000, 350000, 450000, 600000, 850000, 1200000, 1800000, 2500000, 3500000];
  return randomPick(vals);
}

function qualificationFor(status: LeadStatus): 'qualified' | 'not_qualified' | 'pending' {
  if (['technical_visit', 'quote_sent', 'negotiation', 'won'].includes(status)) return 'qualified';
  if (status === 'lost') return 'not_qualified';
  return 'pending';
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.floor(Math.random() * daysBack * 86400000));
}

// ── Main ──────────────────────────────────────────────

async function seedLeads() {
  console.log('Conectando…');
  await connectDB();
  console.log('Conectado.\n');

  const tenant = await TenantModel.findOne({ deletedAt: null }).lean();
  if (!tenant) {
    console.error('No hay tenants. Corré primero el seed completo (scripts/seed.ts).');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.name} (${tenant._id})\n`);

  const users = await UserModel.find({ tenantId, deletedAt: null }).lean();
  if (users.length === 0) {
    console.error('No hay usuarios para este tenant.');
    process.exit(1);
  }
  console.log(`Usuarios: ${users.length}\n`);

  const leads = NAMES.map((name, i) => {
    const status = STATUS_DISTRIBUTION[i];
    const user = randomPick(users);
    const companyName = COMPANIES[i % COMPANIES.length];
    const qualification = qualificationFor(status);
    const reason = status === 'lost' ? randomPick(LOST_REASONS) : undefined;

    return {
      tenantId,
      name,
      companyName,
      email: randomEmail(name),
      phone: randomPhone(),
      source: randomPick(SOURCES),
      status,
      qualificationStatus: qualification,
      assignedTo: user._id,
      estimatedValue: estimatedValue(status),
      notes: status === 'lost'
        ? `Perdido por ${reason} — seguimiento completo.`
        : `Lead generado automáticamente — ${status}`,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      deletedAt: null,
      // Lost fields
      ...(status === 'lost' && {
        lostReason: reason,
        lostDescription: 'El cliente eligió otra opción / no cerró la venta.',
      }),
      // Won fields (just a mock date, no real client)
      ...(status === 'won' && {
        convertedAt: randomDate(30),
      }),
      // Dates spread across last 45 days for variety
      createdAt: randomDate(45),
      updatedAt: new Date(),
    };
  });

  const countBefore = await LeadModel.countDocuments({ tenantId, deletedAt: null });
  console.log(`Leads existentes: ${countBefore}`);

  console.log(`Creando ${leads.length} leads…`);
  const created = await LeadModel.insertMany(leads);
  console.log(`  Creados: ${created.length}`);

  // Summary
  const byStatus = await LeadModel.aggregate([
    { $match: { tenantId, deletedAt: null } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log('\nDistribución final por status:');
  for (const s of byStatus) {
    console.log(`  ${s._id}: ${s.count}`);
  }

  // Calificados total
  const calificados = byStatus
    .filter((s: Record<string, unknown>) =>
      ['technical_visit', 'quote_sent', 'negotiation', 'won'].includes(s._id as string))
    .reduce((sum: number, s: Record<string, unknown>) => sum + (s.count as number), 0);
  console.log(`\nTotal calificados (TV + PE + NEG + WON): ${calificados}`);
  console.log('✅ Seed completado!');

  await mongoose.disconnect();
}

seedLeads().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
