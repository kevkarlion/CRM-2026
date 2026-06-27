import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const { connectDB } = await import('../src/core/db');
import {
  TenantModel,
  UserModel,
  RoleModel,
  UserRoleModel,
} from '../src/core/models';
import {
  ClientModel,
  ContactModel,
  LocationModel,
  EquipmentModel,
} from '../src/crm/models';
import { LeadModel } from '../src/leads/models';
import { QuoteModel, QuoteVersionModel } from '../src/quotes/models';
import {
  ContractModel,
  ContractEquipmentModel,
  MaintenancePlanModel,
  MaintenanceScheduleModel,
} from '../src/contracts/models';
import {
  WorkOrderModel,
  WorkOrderAssignmentModel,
  PreVisitChecklistModel,
  WorkOrderEventModel,
  VisitReportModel,
} from '../src/operations/models';

async function seed() {
  console.log('Connecting to MongoDB...');
  await connectDB();
  console.log('Connected.\n');

  console.log('Dropping database...');
  await mongoose.connection.db!.dropDatabase();
  console.log('Database dropped.\n');

  const ids: Record<string, any> = {};

  // ── 1. Tenant ────────────────────────────────────────────────────────────
  console.log('Creating tenant...');
  const [tenant] = await TenantModel.create([{
    slug: 'demo',
    name: 'Demo Corp',
    status: 'active',
    plan: {
      type: 'professional',
      features: { multiUser: true, contracts: true },
    },
    locale: {
      country: 'CL',
      currency: 'CLP',
      timezone: 'America/Santiago',
      language: 'es',
    },
    deletedAt: null,
  }]);
  ids.tenant = tenant._id;
  const tenantId = tenant._id;
  console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);

  // ── 2. Roles ─────────────────────────────────────────────────────────────
  console.log('Creating roles...');
  const roleData = [
    { name: 'admin', description: 'Administrador del sistema' },
    { name: 'supervisor', description: 'Supervisor de operaciones' },
    { name: 'commercial', description: 'Ejecutivo comercial' },
    { name: 'technician', description: 'Técnico de terreno' },
  ];
  const roles = await RoleModel.create(
    roleData.map(r => ({
      ...r,
      tenantId,
      isSystem: true,
      deletedAt: null,
    }))
  );
  ids.roleAdmin = roles[0]._id;
  ids.roleSupervisor = roles[1]._id;
  ids.roleCommercial = roles[2]._id;
  ids.roleTechnician = roles[3]._id;
  for (const r of roles) {
    console.log(`  Role: ${r.name}`);
  }

  // ── 3. Users ─────────────────────────────────────────────────────────────
  console.log('Creating users...');
  const userData = [
    { email: 'admin@demo.cl', firstName: 'Andrés', lastName: 'Mendoza', roleIdx: 0 },
    { email: 'supervisor@demo.cl', firstName: 'Carolina', lastName: 'Reyes', roleIdx: 1 },
    { email: 'comercial1@demo.cl', firstName: 'Francisco', lastName: 'López', roleIdx: 2 },
    { email: 'comercial2@demo.cl', firstName: 'Valentina', lastName: 'Muñoz', roleIdx: 2 },
    { email: 'tecnico1@demo.cl', firstName: 'Carlos', lastName: 'Muñoz', roleIdx: 3 },
    { email: 'tecnico2@demo.cl', firstName: 'María', lastName: 'González', roleIdx: 3 },
    { email: 'tecnico3@demo.cl', firstName: 'Pedro', lastName: 'Álamos', roleIdx: 3 },
    { email: 'tecnico4@demo.cl', firstName: 'Ana', lastName: 'Soto', roleIdx: 3 },
  ];
  const usersData = [];
  for (const u of userData) {
    usersData.push({
      tenantId,
      email: u.email,
      passwordHash: await bcrypt.hash('Demo2026!', 10),
      firstName: u.firstName,
      lastName: u.lastName,
      status: 'active',
      deletedAt: null,
    });
  }
  const users = await UserModel.create(usersData);
  ids.adminUser = users[0]._id;
  ids.supervisorUser = users[1]._id;
  ids.commercialUsers = [users[2]._id, users[3]._id];
  ids.technicianUsers = [users[4]._id, users[5]._id, users[6]._id, users[7]._id];
  ids.allUsers = users.map(u => u._id);
  for (const u of users) {
    console.log(`  User: ${u.email} — ${u.firstName} ${u.lastName}`);
  }

  // ── 4. UserRoles ─────────────────────────────────────────────────────────
  console.log('Creating user-role assignments...');
  const userRolesData = users.map((u, i) => ({
    tenantId,
    userId: u._id,
    roleId: roles[userData[i].roleIdx]._id,
    assignedBy: users[0]._id,
  }));
  await UserRoleModel.create(userRolesData);
  console.log(`  ${userRolesData.length} user-role assignments created.`);

  // ── 5. Clients ───────────────────────────────────────────────────────────
  console.log('Creating clients...');
  const clientData = [
    { companyName: 'TechCorp Chile S.A.', customerType: 'commercial', status: 'active', taxId: '76.123.456-7', email: 'contacto@techcorp.cl', phone: '+562 2123 4567' },
    { companyName: 'Servicios Integrales del Sur Ltda.', customerType: 'commercial', status: 'active', taxId: '77.234.567-8', email: 'info@sisur.cl', phone: '+564 1234 5678' },
    { companyName: 'Minera Los Pelambres', customerType: 'industrial', status: 'active', taxId: '78.345.678-9', email: 'admin@pelambres.cl', phone: '+565 1234 5678' },
    { companyName: 'Constructora Almagro SpA.', customerType: 'commercial', status: 'active', taxId: '79.456.789-0', email: 'obras@almagro.cl', phone: '+562 2987 6543' },
    { companyName: 'Comercial Puerto Madero', customerType: 'commercial', status: 'active', taxId: '80.567.890-1', email: 'ventas@puertomadero.cl', phone: '+563 2123 4567' },
    { companyName: 'Viña Concha y Toro S.A.', customerType: 'industrial', status: 'active', taxId: '81.678.901-2', email: 'bodega@conchaytoro.cl', phone: '+567 2123 4567' },
    { companyName: 'Clínica Alemana de Santiago', customerType: 'commercial', status: 'active', taxId: '82.789.012-3', email: 'mantencion@alemana.cl', phone: '+562 2210 1111' },
    { fullName: 'Hernán Vallejos', customerType: 'residential', status: 'active', taxId: '13.456.789-4', email: 'hvallejos@gmail.com', phone: '+569 8765 4321' },
    { companyName: 'Inmobiliaria Alto Las Condes', customerType: 'commercial', status: 'active', taxId: '83.890.123-5', email: 'proyectos@alc.cl', phone: '+562 2233 4455' },
    { companyName: 'Luminaria LED Chile Ltda.', customerType: 'commercial', status: 'prospect', taxId: '84.901.234-6', email: 'ventas@luminaria.cl', phone: '+562 2123 8901' },
  ];
  const clients = await ClientModel.create(
    clientData.map(c => ({
      tenantId,
      ...c,
      createdBy: ids.adminUser,
      updatedBy: ids.adminUser,
      deletedAt: null,
    }))
  );
  ids.clients = clients.map(c => c._id);
  for (const c of clients) {
    console.log(`  Client: ${c.companyName || c.fullName} (${c.taxId})`);
  }

  // ── 6. Contacts ──────────────────────────────────────────────────────────
  console.log('Creating contacts...');
  const contactData = [
    { clientIdx: 0, firstName: 'Ricardo', lastName: 'Larenas', role: 'Jefe de Mantención', email: 'rlarenas@techcorp.cl', phone: '+562 2123 4568', isPrimary: true },
    { clientIdx: 0, firstName: 'Pablo', lastName: 'Rojas', role: 'Subgerente de Operaciones', email: 'projas@techcorp.cl', phone: '+562 2123 4569', isPrimary: false },
    { clientIdx: 1, firstName: 'Marta', lastName: 'Soto', role: 'Gerente de Operaciones', email: 'msoto@sisur.cl', phone: '+564 1234 5679', isPrimary: true },
    { clientIdx: 2, firstName: 'Jorge', lastName: 'Pérez', role: 'Superintendente de Planta', email: 'jperez@pelambres.cl', phone: '+565 1234 5679', isPrimary: true },
    { clientIdx: 3, firstName: 'Claudia', lastName: 'Rivas', role: 'Encargada de Proyectos', email: 'crivas@almagro.cl', phone: '+562 2987 6544', isPrimary: true },
    { clientIdx: 4, firstName: 'Luis', lastName: 'Cifuentes', role: 'Administrador', email: 'lcifuentes@puertomadero.cl', phone: '+563 2123 4568', isPrimary: true },
    { clientIdx: 5, firstName: 'Ana María', lastName: 'Cruz', role: 'Jefa de Mantención', email: 'acruz@conchaytoro.cl', phone: '+567 2123 4568', isPrimary: true },
    { clientIdx: 6, firstName: 'Dr. Patricio', lastName: 'Mena', role: 'Director Médico', email: 'pmena@alemana.cl', phone: '+562 2210 1112', isPrimary: true },
    { clientIdx: 6, firstName: 'Roberto', lastName: 'Gálvez', role: 'Jefe de Infraestructura', email: 'rgalvez@alemana.cl', phone: '+562 2210 1113', isPrimary: false },
    { clientIdx: 7, firstName: 'Hernán', lastName: 'Vallejos', role: 'Propietario', email: 'hvallejos@gmail.com', phone: '+569 8765 4321', isPrimary: true },
    { clientIdx: 8, firstName: 'Felipe', lastName: 'Izquierdo', role: 'Gerente de Proyectos', email: 'fizquierdo@alc.cl', phone: '+562 2233 4456', isPrimary: true },
    { clientIdx: 9, firstName: 'Daniela', lastName: 'Flores', role: 'Encargada de Compras', email: 'dflores@luminaria.cl', phone: '+562 2123 8902', isPrimary: true },
  ];
  const contacts = await ContactModel.create(
    contactData.map(c => ({
      tenantId,
      clientId: clients[c.clientIdx]._id,
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary,
      createdBy: ids.adminUser,
      updatedBy: ids.adminUser,
      deletedAt: null,
    }))
  );
  ids.contacts = contacts.map(c => c._id);
  console.log(`  ${contacts.length} contacts created.`);

  // ── 7. Locations ─────────────────────────────────────────────────────────
  console.log('Creating locations...');
  const locationData = [
    { clientIdx: 0, name: 'Sede Central', address: 'Av. Apoquindo 4800', city: 'Santiago', province: 'Santiago', country: 'CL', postalCode: '7560000' },
    { clientIdx: 1, name: 'Planta Sur', address: 'Ruta 5 Sur Km 420', city: 'Temuco', province: 'Cautín', country: 'CL', postalCode: '4780000' },
    { clientIdx: 2, name: 'Faena Los Pelambres', address: 'Camino Minero s/n', city: 'Los Andes', province: 'Los Andes', country: 'CL', postalCode: '2140000' },
    { clientIdx: 3, name: 'Oficina Central', address: 'Av. Nueva Providencia 1860', city: 'Santiago', province: 'Santiago', country: 'CL', postalCode: '7500000' },
    { clientIdx: 4, name: 'Edificio Corporativo', address: 'Av. España 1050', city: 'Valparaíso', province: 'Valparaíso', country: 'CL', postalCode: '2340000' },
    { clientIdx: 5, name: 'Viña Pirque', address: 'Av. Concha y Toro 3300', city: 'Puente Alto', province: 'Cordillera', country: 'CL', postalCode: '8150000' },
    { clientIdx: 6, name: 'Hospital Clínico', address: 'Av. Vitacura 5950', city: 'Santiago', province: 'Santiago', country: 'CL', postalCode: '7650000' },
    { clientIdx: 7, name: 'Domicilio Particular', address: 'Los Olivos 1234', city: 'Viña del Mar', province: 'Valparaíso', country: 'CL', postalCode: '2520000' },
    { clientIdx: 8, name: 'Proyecto Los Dominicos', address: 'Av. Los Dominicos 6100', city: 'Santiago', province: 'Santiago', country: 'CL', postalCode: '7690000' },
    { clientIdx: 9, name: 'Bodega Principal', address: 'Av. Industrial 550', city: 'Rancagua', province: 'Cachapoal', country: 'CL', postalCode: '2820000' },
  ];
  const locations = await LocationModel.create(
    locationData.map(l => ({
      tenantId,
      clientId: clients[l.clientIdx]._id,
      name: l.name,
      address: l.address,
      city: l.city,
      province: l.province,
      country: l.country,
      postalCode: l.postalCode,
      createdBy: ids.adminUser,
      updatedBy: ids.adminUser,
      deletedAt: null,
    }))
  );
  ids.locations = locations.map(l => l._id);
  for (const l of locations) {
    console.log(`  Location: ${l.name}, ${l.city}`);
  }

  // ── 8. Equipment ─────────────────────────────────────────────────────────
  console.log('Creating equipment...');
  const equipTypes = ['split', 'multisplit', 'chiller', 'rooftop', 'industrial'] as const;
  const brands = ['Daikin', 'Carrier', 'Midea', 'LG', 'York'];
  const equipmentData: Array<{ locIdx: number; type: typeof equipTypes[number]; brand: string; model: string; serial: string; installDate: Date }> = [];

  const locEquipment = [
    { locIdx: 0, count: 3 },
    { locIdx: 1, count: 2 },
    { locIdx: 2, count: 4 },
    { locIdx: 3, count: 2 },
    { locIdx: 4, count: 2 },
    { locIdx: 5, count: 3 },
    { locIdx: 6, count: 4 },
    { locIdx: 7, count: 2 },
    { locIdx: 8, count: 2 },
    { locIdx: 9, count: 2 },
  ];

  let serialCounter = 1;
  for (const le of locEquipment) {
    for (let i = 0; i < le.count; i++) {
      const typeIdx = (serialCounter - 1) % equipTypes.length;
      const brandIdx = (serialCounter - 1) % brands.length;
      const monthsAgo = 6 + Math.floor(Math.random() * 48);
      const installDate = new Date();
      installDate.setMonth(installDate.getMonth() - monthsAgo);
      equipmentData.push({
        locIdx: le.locIdx,
        type: equipTypes[typeIdx],
        brand: brands[brandIdx],
        model: `${brands[brandIdx]} ${equipTypes[typeIdx].charAt(0).toUpperCase() + equipTypes[typeIdx].slice(1)}-${1000 + serialCounter}`,
        serial: `SN-${String(serialCounter).padStart(6, '0')}`,
        installDate,
      });
      serialCounter++;
    }
  }

  const equipmentDocs = await EquipmentModel.create(
    equipmentData.map(e => ({
      tenantId,
      clientId: locations[e.locIdx].clientId,
      locationId: locations[e.locIdx]._id,
      equipmentType: e.type,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serial,
      installationDate: e.installDate,
      warrantyExpiration: new Date(e.installDate.getFullYear() + 5, e.installDate.getMonth(), e.installDate.getDate()),
      status: 'active',
      createdBy: ids.adminUser,
      updatedBy: ids.adminUser,
      deletedAt: null,
    }))
  );
  ids.equipment = equipmentDocs.map(eq => eq._id);
  ids.equipmentByLoc = {};
  for (let i = 0; i < equipmentDocs.length; i++) {
    const leIdx = equipmentData[i].locIdx;
    if (!ids.equipmentByLoc[leIdx]) ids.equipmentByLoc[leIdx] = [];
    ids.equipmentByLoc[leIdx].push(equipmentDocs[i]._id);
  }
  console.log(`  ${equipmentDocs.length} equipment created.`);

  // ── 9. Leads ─────────────────────────────────────────────────────────────
  console.log('Creating leads...');
  const leadData = [
    { name: 'Mario Riquelme', companyName: 'Restaurant El Rincón', source: 'whatsapp' as const, status: 'new' as const, notes: 'Cliente llamó por cotización de aire acondicionado para su local' },
    { name: 'Sofía Cárdenas', companyName: 'Farmacia Central', source: 'call' as const, status: 'new' as const, notes: 'Solicitó información sobre mantenciones preventivas' },
    { name: 'Diego Aravena', companyName: 'Gimnasio FitZone', source: 'form' as const, status: 'new' as const, notes: 'Formulario web: necesita climatización para 200m2' },
    { name: 'Javiera Valdés', companyName: 'Colegio Los Alerces', source: 'form' as const, status: 'new' as const, notes: 'Requiere sistemas de climatización para 5 salas' },
    { name: 'Cristián Pérez', companyName: 'Oficinas del Centro', source: 'referral' as const, status: 'contacted' as const, assignedToIdx: 2, notes: 'Cliente referido por TechCorp. Ya se contactó vía telefónica' },
    { name: 'Angélica Muñoz', companyName: 'Clínica Dental Care', source: 'whatsapp' as const, status: 'contacted' as const, assignedToIdx: 3, notes: 'Contactada, envió croquis del lugar' },
    { name: 'Rodrigo Palma', companyName: 'Hotel Boutique Alto', source: 'call' as const, status: 'contacted' as const, assignedToIdx: 2, notes: 'Interesado en sistema multisplit para 8 habitaciones' },
    { name: 'Tamara Vega', companyName: 'Supermercado del Sur', source: 'form' as const, status: 'qualified' as const, assignedToIdx: 3, estimatedValue: 4500000, notes: 'Requiere 3 equipos de 24.000 BTU. Presupuesto aprobado internamente' },
    { name: 'Gonzalo Tapia', companyName: 'Centro Médico Ovalle', source: 'referral' as const, status: 'qualified' as const, assignedToIdx: 2, estimatedValue: 8200000, notes: 'Necesita climatización completa para 12 consultorios' },
    { name: 'Paula Contreras', companyName: 'Cafetería La Vinocracia', source: 'whatsapp' as const, status: 'qualified' as const, assignedToIdx: 3, estimatedValue: 1800000, notes: 'Sistema split para terraza techada. Competencia también cotizó' },
    { name: 'Empresa Constructora del Valle', companyName: 'Constructora del Valle', source: 'referral' as const, status: 'won' as const, convertedToClientIdx: 3, estimatedValue: 15000000, notes: 'Ganamos licitación de climatización para nuevo edificio' },
    { name: 'Bodegas Santa Rita', companyName: 'Bodegas Santa Rita Ltda.', source: 'form' as const, status: 'won' as const, convertedToClientIdx: 5, estimatedValue: 9500000, notes: 'Contrato firmado para mantención de cámaras de frío' },
    { name: 'Rubén Díaz', companyName: 'Taller Mecánico El Puerto', source: 'call' as const, status: 'lost' as const, notes: 'Nos dijo que ya contrató a la competencia. Precio muy alto.' },
    { name: 'Inmobiliaria Parque Sur', companyName: 'Inmobiliaria Parque Sur', source: 'form' as const, status: 'lost' as const, estimatedValue: 21000000, notes: 'Perdimos contra Carrier. Dijeron que nuestra propuesta técnica no alcanzaba sus requerimientos.' },
    { name: 'Particular', companyName: '', source: 'walk_in' as const, status: 'disqualified' as const, notes: 'Solicitaba servicio fuera de nuestra zona de cobertura (Punta Arenas).' },
  ];

  const leads = await LeadModel.create(
    leadData.map(l => {
      const doc: any = {
        tenantId,
        name: l.name,
        companyName: l.companyName,
        source: l.source,
        status: l.status,
        notes: l.notes,
        createdBy: 'seed-user',
        updatedBy: 'seed-user',
        deletedAt: null,
      };
      if (l.assignedToIdx !== undefined) {
        doc.assignedTo = users[l.assignedToIdx]._id;
      }
      if (l.estimatedValue !== undefined) {
        doc.estimatedValue = l.estimatedValue;
      }
      if (l.status === 'won' && l.convertedToClientIdx !== undefined) {
        doc.convertedToClient = clients[l.convertedToClientIdx]._id;
        doc.convertedAt = new Date();
      }
      return doc;
    })
  );
  ids.leads = leads.map(l => l._id);
  for (const l of leads) {
    console.log(`  Lead: ${l.name} — ${l.status} (${l.source})`);
  }

  // ── 10. Quotes + QuoteVersions ───────────────────────────────────────────
  console.log('Creating quotes...');
  const now = new Date();
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const quoteStatuses = ['draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled'] as const;
  const quoteSpecs = [
    { status: 'draft', clientIdx: 0, title: 'Mantención Preventiva Anual', subtotal: 0, description: 'Borrador en elaboración' },
    { status: 'draft', clientIdx: 3, title: 'Instalación Sistema Split', subtotal: 0, description: 'Esperando definición de equipos' },
    { status: 'sent', clientIdx: 1, title: 'Reparación Chiller', subtotal: 2300000, description: 'Reparación de compresor Chiller Carrier' },
    { status: 'sent', clientIdx: 7, title: 'Mantención Split Residencial', subtotal: 180000, description: 'Limpieza y revisión de 2 equipos' },
    { status: 'approved', clientIdx: 4, title: 'Instalación HVAC Local Comercial', subtotal: 5600000, description: 'Instalación de 3 sistemas split inverter' },
    { status: 'approved', clientIdx: 2, title: 'Overhaul Chiller Principal', subtotal: 12800000, description: 'Overhaul completo chiller York 200Tn' },
    { status: 'rejected', clientIdx: 6, title: 'Mantención Urgente Cámaras Frío', subtotal: 3400000, description: 'Cliente rechazó por presupuesto' },
    { status: 'rejected', clientIdx: 8, title: 'Climatización Sala Ventas', subtotal: 4200000, description: 'Rechazado, contrataron a otro proveedor' },
    { status: 'expired', clientIdx: 5, title: 'Mantención Equipos Bodega', subtotal: 890000, validUntil: addDays(now, -45), description: 'Oferta expiró sin respuesta' },
    { status: 'cancelled', clientIdx: 9, title: 'Proyecto Climatización Oficinas', subtotal: 15000000, description: 'Cliente canceló el proyecto completo' },
  ];

  const quotes = await QuoteModel.create(
    quoteSpecs.map((q, i) => {
      const sub = q.subtotal;
      const tax = Math.round(sub * 0.19);
      const total = sub + tax;
      const validUntil = q.validUntil || addDays(now, 30);
      const num = String(i + 1).padStart(3, '0');
      return {
        tenantId,
        clientId: clients[q.clientIdx]._id,
        number: `COT-2026-${num}`,
        status: q.status,
        currentVersion: 1,
        title: q.title,
        description: q.description,
        validUntil,
        subtotal: sub,
        discountAmount: 0,
        taxAmount: tax,
        total,
        createdBy: ids.adminUser,
        updatedBy: ids.adminUser,
        deletedAt: null,
      };
    })
  );
  ids.quotes = quotes.map(q => q._id);
  for (const q of quotes) {
    console.log(`  Quote: ${q.number} — ${q.status}`);
  }

  // QuoteVersion items per quote
  const quoteItemSets: Record<string, Array<{ description: string; type: 'product' | 'service' | 'labor' | 'material' | 'part'; quantity: number; unitPrice: number }>> = {
    draft_0: [],
    draft_1: [],
    sent_2: [
      { description: 'Reparación compresor Chiller Carrier 30RB', type: 'service', quantity: 1, unitPrice: 1200000 },
      { description: 'Carga de refrigerante R-134a', type: 'material', quantity: 12, unitPrice: 35000 },
      { description: 'Filtros secadores', type: 'part', quantity: 2, unitPrice: 45000 },
      { description: 'Mano de obra especializada', type: 'labor', quantity: 16, unitPrice: 45000 },
    ],
    sent_3: [
      { description: 'Limpieza profunda unidad evaporadora', type: 'service', quantity: 2, unitPrice: 35000 },
      { description: 'Limpieza profunda unidad condensadora', type: 'service', quantity: 2, unitPrice: 35000 },
      { description: 'Revisión eléctrica completa', type: 'service', quantity: 1, unitPrice: 25000 },
      { description: 'Filtros de aire (repuesto)', type: 'part', quantity: 4, unitPrice: 5000 },
    ],
    approved_4: [
      { description: 'Split Inverter Daikin 24.000 BTU', type: 'product', quantity: 3, unitPrice: 890000 },
      { description: 'Soportería y canalización', type: 'material', quantity: 1, unitPrice: 350000 },
      { description: 'Cableado eléctrico y protecciones', type: 'material', quantity: 1, unitPrice: 280000 },
      { description: 'Instalación y puesta en marcha', type: 'labor', quantity: 24, unitPrice: 35000 },
      { description: 'Retiro de equipos antiguos', type: 'service', quantity: 1, unitPrice: 120000 },
    ],
    approved_5: [
      { description: 'Kit overhaul chiller York YT', type: 'product', quantity: 1, unitPrice: 4200000 },
      { description: 'Aceite ISO 32 (galón)', type: 'material', quantity: 8, unitPrice: 85000 },
      { description: 'Filtros de aceite', type: 'part', quantity: 4, unitPrice: 65000 },
      { description: 'Junta y empaquetaduras', type: 'part', quantity: 1, unitPrice: 180000 },
      { description: 'Mano de obra overhaul', type: 'labor', quantity: 80, unitPrice: 55000 },
    ],
    rejected_6: [
      { description: 'Reparación sistema refrigeración cámara 1', type: 'service', quantity: 1, unitPrice: 850000 },
      { description: 'Reparación sistema refrigeración cámara 2', type: 'service', quantity: 1, unitPrice: 950000 },
      { description: 'Válvulas de expansión', type: 'part', quantity: 4, unitPrice: 120000 },
      { description: 'Gas refrigerante R-404A', type: 'material', quantity: 15, unitPrice: 45000 },
      { description: 'Mano de obra', type: 'labor', quantity: 20, unitPrice: 45000 },
    ],
    rejected_7: [
      { description: 'Sistema split Mitsubishi 18.000 BTU', type: 'product', quantity: 2, unitPrice: 750000 },
      { description: 'Sistema split Mitsubishi 12.000 BTU', type: 'product', quantity: 1, unitPrice: 550000 },
      { description: 'Instalación completa', type: 'labor', quantity: 16, unitPrice: 35000 },
      { description: 'Materiales eléctricos', type: 'material', quantity: 1, unitPrice: 180000 },
    ],
    expired_8: [
      { description: 'Mantención preventiva equipos bodega', type: 'service', quantity: 4, unitPrice: 95000 },
      { description: 'Revisión y ajuste correas', type: 'service', quantity: 4, unitPrice: 25000 },
      { description: 'Lubricación rodamientos', type: 'service', quantity: 8, unitPrice: 15000 },
      { description: 'Filtros de aire industriales', type: 'part', quantity: 8, unitPrice: 12000 },
    ],
    cancelled_9: [
      { description: 'Sistema centralizado LG 60.000 BTU', type: 'product', quantity: 1, unitPrice: 6500000 },
      { description: 'Conductos y rejillas', type: 'material', quantity: 1, unitPrice: 1200000 },
      { description: 'Termostatos inteligentes', type: 'product', quantity: 8, unitPrice: 85000 },
      { description: 'Instalación completa', type: 'labor', quantity: 60, unitPrice: 45000 },
    ],
  };

  const qvKey = (q: typeof quotes[0]) => `${q.status}_${quotes.indexOf(q)}`;
  const qvData = [];
  for (const q of quotes) {
    const key = qvKey(q);
    const items = quoteItemSets[key] || [];
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + tax;
    qvData.push({
      tenantId,
      quoteId: q._id,
      version: 1,
      title: q.title,
      items: items.map(i => ({
        ...i,
        subtotal: i.quantity * i.unitPrice,
      })),
      subtotal,
      discountAmount: 0,
      taxAmount: tax,
      total,
      createdBy: ids.adminUser,
    });

    // Update quote totals if they have items
    if (items.length > 0) {
      q.subtotal = subtotal;
      q.taxAmount = tax;
      q.total = total;
      await q.save();
    }
  }
  await QuoteVersionModel.create(qvData);
  console.log(`  ${qvData.length} quote versions created.`);

  // ── 11. Contracts ────────────────────────────────────────────────────────
  console.log('Creating contracts...');
  const within30 = addDays(now, 20);
  const contractSpecs = [
    { clientIdx: 0, name: 'Mantención Preventiva TechCorp 2026', status: 'active', startDate: new Date('2026-01-01'), endDate: new Date('2027-12-31') },
    { clientIdx: 2, name: 'Mantención Equipos Minera Pelambres', status: 'active', startDate: new Date('2026-03-01'), endDate: new Date('2027-03-01') },
    { clientIdx: 4, name: 'Mantención HVAC Puerto Madero', status: 'active', startDate: new Date('2026-02-15'), endDate: new Date('2027-02-15') },
    { clientIdx: 6, name: 'Contrato Climatización Clínica Alemana', status: 'active', startDate: new Date('2026-04-01'), endDate: new Date('2027-04-01') },
    { clientIdx: 5, name: 'Mantención Cámaras Viña Concha y Toro', status: 'active', startDate: new Date('2026-05-01'), endDate: within30 },
    { clientIdx: 1, name: 'Servicio Integral Sur', status: 'active', startDate: new Date('2026-04-15'), endDate: addDays(now, 15) },
    { clientIdx: 8, name: 'Proyecto Alto Las Condes', status: 'paused', startDate: new Date('2026-02-01'), endDate: new Date('2027-02-01') },
    { clientIdx: 3, name: 'Constructora Almagro 2025', status: 'expired', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
  ];

  const contracts = await ContractModel.create(
    contractSpecs.map((c, i) => ({
      tenantId,
      clientId: clients[c.clientIdx]._id,
      status: c.status,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      frequency: { interval: 3, unit: 'months' },
      clientSnapshot: {
        name: clients[c.clientIdx].companyName || clients[c.clientIdx].fullName,
        email: clients[c.clientIdx].email,
        phone: clients[c.clientIdx].phone,
      },
      createdBy: 'seed-user',
      updatedBy: 'seed-user',
      deletedAt: null,
    }))
  );
  ids.contracts = contracts.map(c => c._id);
  ids.activeContractIdxs = [0, 1, 2, 3, 4, 5];
  for (const c of contracts) {
    console.log(`  Contract: ${c.name} — ${c.status}`);
  }

  // ── 12. ContractEquipment ────────────────────────────────────────────────
  console.log('Creating contract-equipment links...');
  const ceData: Array<{ contractIdx: number; equipIndices: number[] }> = [];
  for (let ci = 0; ci < contracts.length; ci++) {
    const clientIdx = contractSpecs[ci].clientIdx;
    const eqs = ids.equipmentByLoc[clientIdx] || [];
    if (eqs.length > 0) {
      ceData.push({ contractIdx: ci, equipIndices: eqs.map((_: any, i: number) => i) });
    }
  }

  // Map actual equipment IDs by location
  const ceDocs: Array<{ tenantId: any; contractId: any; equipmentId: any; includedAt: Date }> = [];
  for (let ci = 0; ci < contracts.length; ci++) {
    const clientIdx = contractSpecs[ci].clientIdx;
    const eqs = ids.equipmentByLoc[clientIdx] || [];
    for (const eqId of eqs) {
      ceDocs.push({
        tenantId,
        contractId: contracts[ci]._id,
        equipmentId: eqId,
        includedAt: contracts[ci].startDate,
      });
    }
  }
  await ContractEquipmentModel.create(ceDocs);
  console.log(`  ${ceDocs.length} contract-equipment links created.`);

  // ── 13. MaintenancePlans ─────────────────────────────────────────────────
  console.log('Creating maintenance plans...');
  const activeContractIdxs = contractSpecs.map((c, i) => c.status === 'active' ? i : -1).filter(i => i >= 0);
  const planSpecs: Array<{ contractIdx: number; name: string; interval: number; unit: 'monthly' | 'quarterly' | 'biannual' | 'annual'; template: string[] }> = [
    { contractIdx: 0, name: 'Plan Mantención Trimestral', interval: 3, unit: 'monthly', template: ['Revisión filtros', 'Limpieza condensadores', 'Verificación presiones', 'Revisión eléctrica'] },
    { contractIdx: 0, name: 'Plan Mantención Anual', interval: 1, unit: 'annual', template: ['Overhaul general', 'Cambio filtros', 'Lubricación motores', 'Revisión estructural'] },
    { contractIdx: 1, name: 'Plan Mensual Equipos Mina', interval: 1, unit: 'monthly', template: ['Inspección visual', 'Medición amperaje', 'Verificación refrigerante', 'Lubricación'] },
    { contractIdx: 2, name: 'Plan Trimestral HVAC', interval: 3, unit: 'monthly', template: ['Revisión splits', 'Limpieza bandejas', 'Verificación gas', 'Control remoto'] },
    { contractIdx: 3, name: 'Plan Mantención Preventiva', interval: 2, unit: 'monthly', template: ['Revisión equipos críticos', 'Limpieza filtros', 'Verificación alarmas', 'Reporte estado'] },
    { contractIdx: 3, name: 'Plan Semestral', interval: 6, unit: 'monthly', template: ['Revisión completa', 'Cambio filtros', 'Verificación estructural', 'Pruebas de funcionamiento'] },
    { contractIdx: 4, name: 'Plan Quincenal Cámaras', interval: 2, unit: 'monthly', template: ['Revisión temperatura', 'Limpieza condensadores', 'Verificación puertas', 'Estado compresores'] },
    { contractIdx: 5, name: 'Plan Mantención General', interval: 1, unit: 'monthly', template: ['Revisión general', 'Limpieza', 'Reporte'] },
  ];

  const plans = await MaintenancePlanModel.create(
    planSpecs.map(p => ({
      tenantId,
      contractId: contracts[p.contractIdx]._id,
      name: p.name,
      interval: p.interval,
      unit: p.unit,
      checklistTemplate: p.template,
      active: true,
      createdBy: 'seed-user',
      updatedBy: 'seed-user',
      deletedAt: null,
    }))
  );
  ids.plans = plans.map(p => p._id);
  for (const p of plans) {
    console.log(`  Plan: ${p.name} (every ${p.interval} ${p.unit})`);
  }

  // ── 14. MaintenanceSchedules ─────────────────────────────────────────────
  console.log('Creating maintenance schedules...');
  const scheduleData: Array<{ planIdx: number; date: Date; status: 'scheduled' | 'completed'; equipmentIdx: number }> = [];
  for (let pi = 0; pi < plans.length; pi++) {
    const contract = contracts[planSpecs[pi].contractIdx];
    const numSchedules = pi % 2 === 0 ? 4 : 2;
    for (let si = 0; si < numSchedules; si++) {
      const monthsOffset = si * planSpecs[pi].interval;
      const d = new Date(contract.startDate);
      d.setMonth(d.getMonth() + monthsOffset);
      const status = d < now ? 'completed' : 'scheduled';
      const clientIdx = contractSpecs[planSpecs[pi].contractIdx].clientIdx;
      const eqs = ids.equipmentByLoc[clientIdx] || [];
      const eqIdx = si % Math.max(eqs.length, 1);
      scheduleData.push({ planIdx: pi, date: d, status, equipmentIdx: eqIdx });
    }
  }

  const schedules = await MaintenanceScheduleModel.create(
    scheduleData.map(s => {
      const plan = plans[s.planIdx];
      const contract = contracts[planSpecs[s.planIdx].contractIdx];
      const clientIdx = contractSpecs[planSpecs[s.planIdx].contractIdx].clientIdx;
      const eqs = ids.equipmentByLoc[clientIdx] || [];
      return {
        tenantId,
        contractId: contract._id,
        maintenancePlanId: plan._id,
        equipmentIds: eqs.length > 0 ? [eqs[s.equipmentIdx % eqs.length]] : [],
        scheduledDate: s.date,
        status: s.status,
      };
    })
  );
  ids.schedules = schedules.map(s => s._id);
  console.log(`  ${schedules.length} maintenance schedules created.`);

  // ── 15. Work Orders ──────────────────────────────────────────────────────
  console.log('Creating work orders...');
  const woStatuses = ['draft', 'draft', 'scheduled', 'scheduled', 'confirmed', 'confirmed', 'assigned', 'assigned', 'en_route', 'on_site', 'completed', 'closed'] as const;
  const woPriorities = ['low', 'normal', 'normal', 'high', 'normal', 'urgent', 'normal', 'high', 'normal', 'normal', 'normal', 'low'] as const;
  const woCategories = ['maintenance', 'installation', 'maintenance', 'repair', 'inspection', 'emergency', 'maintenance', 'repair', 'maintenance', 'inspection', 'maintenance', 'installation'] as const;
  const woSources = ['manual', 'maintenance_contract', 'manual', 'maintenance_contract', 'manual', 'maintenance_contract', 'manual', 'maintenance_contract', 'manual', 'manual', 'maintenance_contract', 'manual'] as const;

  // Pick clients for each WO
  const woClientIdxs = [0, 2, 1, 4, 6, 3, 7, 5, 0, 8, 2, 1];

  const woDocs = [];
  for (let i = 0; i < 12; i++) {
    const clientIdx = woClientIdxs[i];
    const client = clients[clientIdx];
    const loc = locations[clientIdx];
    const eqList = ids.equipmentByLoc[clientIdx] || [];
    const eq = eqList.length > 0 ? eqList[0] : null;
    const source = woSources[i];
    const isContractSource = source === 'maintenance_contract';
    const contractIdx = contractSpecs.findIndex(c => c.clientIdx === clientIdx && (c.status === 'active' || c.status === 'paused'));
    const contract = contractIdx >= 0 ? contracts[contractIdx] : null;

    const doc: any = {
      tenantId,
      clientId: client._id,
      locationId: loc._id,
      equipmentId: eq,
      source,
      workOrderNumber: `WO-2026-${String(i + 1).padStart(3, '0')}`,
      title: `${woCategories[i] === 'maintenance' ? 'Mantención' : woCategories[i] === 'installation' ? 'Instalación' : woCategories[i] === 'repair' ? 'Reparación' : woCategories[i] === 'inspection' ? 'Inspección' : 'Emergencia'} — ${client.companyName || client.fullName}`,
      description: `Orden de trabajo generada para ${client.companyName || client.fullName} en ${loc.name}`,
      priority: woPriorities[i],
      category: woCategories[i],
      status: woStatuses[i],
      scheduledDate: addDays(now, -5 + i * 2),
      scheduledStart: addDays(now, -5 + i * 2),
      scheduledEnd: addDays(now, -5 + i * 2 + 1),
      estimatedDuration: 4,
      clientSnapshot: {
        name: client.companyName || client.fullName,
        email: client.email,
        phone: client.phone,
        taxId: client.taxId,
        customerType: client.customerType,
        status: client.status,
      },
      locationSnapshot: {
        name: loc.name,
        address: loc.address,
        city: loc.city,
        province: loc.province,
        country: loc.country,
        postalCode: loc.postalCode,
      },
      equipmentSnapshot: eq ? {
        equipmentType: 'split',
        brand: 'Daikin',
        model: 'FTXS-24K',
        serialNumber: 'SN-000001',
        status: 'active',
      } : null,
      contractSnapshot: isContractSource && contract ? {
        contractId: contract._id,
        contractName: contract.name,
        maintenanceScheduleId: ids.schedules[0] || null,
        planName: 'Mantención Preventiva',
        equipmentIds: eqList.slice(0, 2),
      } : null,
      assignedTechnicians: woStatuses[i] === 'assigned' || woStatuses[i] === 'en_route' || woStatuses[i] === 'on_site' || woStatuses[i] === 'completed' || woStatuses[i] === 'closed'
        ? [ids.technicianUsers[i % ids.technicianUsers.length]] : [],
      createdBy: ids.adminUser,
      updatedBy: ids.adminUser,
      deletedAt: null,
    };
    woDocs.push(doc);
  }

  const workOrders = await WorkOrderModel.create(woDocs);
  ids.workOrders = workOrders.map(wo => wo._id);
  for (const wo of workOrders) {
    console.log(`  WO: ${wo.workOrderNumber} — ${wo.status} (${wo.category}, ${wo.priority})`);
  }

  // ── 16. WorkOrderEvents ──────────────────────────────────────────────────
  console.log('Creating work order events...');
  const woEvents = [];
  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i];
    woEvents.push({
      tenantId,
      workOrderId: wo._id,
      eventType: 'created',
      description: `Orden de trabajo ${wo.workOrderNumber} creada`,
      performedBy: ids.adminUser,
    });

    const status = wo.status;
    if (status === 'assigned' || status === 'en_route' || status === 'on_site' || status === 'completed' || status === 'closed') {
      const techIdx = i % ids.technicianUsers.length;
      woEvents.push({
        tenantId,
        workOrderId: wo._id,
        eventType: 'assigned',
        description: 'Técnico asignado a la orden',
        performedBy: ids.adminUser,
        metadata: { technicianId: ids.technicianUsers[techIdx] },
      });
    }
    if (status === 'on_site' || status === 'completed' || status === 'closed') {
      woEvents.push({
        tenantId,
        workOrderId: wo._id,
        eventType: 'visit_started',
        description: 'Técnico inició visita en terreno',
        performedBy: ids.technicianUsers[i % ids.technicianUsers.length],
      });
    }
    if (status === 'completed' || status === 'closed') {
      woEvents.push({
        tenantId,
        workOrderId: wo._id,
        eventType: 'visit_completed',
        description: 'Visita técnica completada',
        performedBy: ids.technicianUsers[i % ids.technicianUsers.length],
      });
    }
  }
  await WorkOrderEventModel.create(woEvents);
  console.log(`  ${woEvents.length} work order events created.`);

  // ── 17. WorkOrderAssignments ─────────────────────────────────────────────
  console.log('Creating work order assignments...');
  const woAssignments = [];
  for (let i = 0; i < workOrders.length; i++) {
    const status = workOrders[i].status;
    if (status === 'assigned' || status === 'en_route' || status === 'on_site' || status === 'completed' || status === 'closed') {
      const techIdx = i % ids.technicianUsers.length;
      woAssignments.push({
        tenantId,
        workOrderId: workOrders[i]._id,
        technicianId: ids.technicianUsers[techIdx],
        assignedBy: ids.adminUser,
        assignedAt: addDays(now, -5 + i * 2),
        status: 'assigned',
      });
    }
  }
  await WorkOrderAssignmentModel.create(woAssignments);
  console.log(`  ${woAssignments.length} work order assignments created.`);

  // ── 18. VisitReports ─────────────────────────────────────────────────────
  console.log('Creating visit reports...');
  const completedWOIdxs = workOrders
    .map((wo, i) => (wo.status === 'completed' || wo.status === 'closed') ? i : -1)
    .filter(i => i >= 0);
  const visitReports = [];
  for (const i of completedWOIdxs) {
    const wo = workOrders[i];
    const techIdx = i % ids.technicianUsers.length;
    const arrTime = new Date(wo.scheduledStart!);
    arrTime.setHours(9, 0, 0, 0);
    const depTime = new Date(arrTime);
    depTime.setHours(arrTime.getHours() + 4);
    visitReports.push({
      tenantId,
      workOrderId: wo._id,
      technicianId: ids.technicianUsers[techIdx],
      arrivalTime: arrTime,
      departureTime: depTime,
      workPerformed: `Se realizó ${wo.category} según lo planificado. ${wo.description}`,
      observations: 'Equipo funcionando correctamente. Sin novedades.',
      recommendations: 'Próxima mantención en 3 meses.',
      version: 1,
      createdBy: ids.technicianUsers[techIdx],
      updatedBy: ids.technicianUsers[techIdx],
    });
  }
  await VisitReportModel.create(visitReports);
  console.log(`  ${visitReports.length} visit reports created.`);

  // ── 19. PreVisitChecklist ────────────────────────────────────────────────
  console.log('Creating pre-visit checklists...');
  const checklistWOIdxs = workOrders
    .map((wo, i) => (wo.status === 'assigned' || wo.status === 'en_route' || wo.status === 'on_site' || wo.status === 'completed' || wo.status === 'closed') ? i : -1)
    .filter(i => i >= 0);
  const checklists = [];
  for (const i of checklistWOIdxs) {
    const wo = workOrders[i];
    const techIdx = i % ids.technicianUsers.length;
    checklists.push({
      tenantId,
      workOrderId: wo._id,
      workOrderReviewed: true,
      toolsPrepared: true,
      partsAvailable: wo.status === 'completed' || wo.status === 'closed' || wo.status === 'on_site',
      routeConfirmed: true,
      vehicleAssigned: true,
      safetyEquipmentChecked: true,
      completedBy: ids.technicianUsers[techIdx],
      completedAt: addDays(now, -5 + i * 2),
    });
  }
  await PreVisitChecklistModel.create(checklists);
  console.log(`  ${checklists.length} pre-visit checklists created.`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('         SEED COMPLETE — SUMMARY');
  console.log('══════════════════════════════════════════');
  const summary = [
    ['Tenants', 1],
    ['Roles', roles.length],
    ['Users', users.length],
    ['UserRoles', userRolesData.length],
    ['Clients', clients.length],
    ['Contacts', contacts.length],
    ['Locations', locations.length],
    ['Equipment', equipmentDocs.length],
    ['Leads', leads.length],
    ['Quotes', quotes.length],
    ['QuoteVersions', qvData.length],
    ['Contracts', contracts.length],
    ['ContractEquipment', ceDocs.length],
    ['MaintenancePlans', plans.length],
    ['MaintenanceSchedules', schedules.length],
    ['WorkOrders', workOrders.length],
    ['WorkOrderEvents', woEvents.length],
    ['WorkOrderAssignments', woAssignments.length],
    ['VisitReports', visitReports.length],
    ['PreVisitChecklists', checklists.length],
  ];
  const colWidth = Math.max(...summary.map(s => s[0].length)) + 2;
  for (const [label, count] of summary) {
    console.log(`  ${label.padEnd(colWidth)} ${count}`);
  }
  console.log('══════════════════════════════════════════\n');

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
