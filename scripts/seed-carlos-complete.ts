import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-2026';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await connectDB();
  console.log('Connected.\n');

  const db = mongoose.connection.db!;

  const tenant = await db.collection('tenants').findOne({});
  if (!tenant) {
    console.error('❌ No tenant found.');
    process.exit(1);
  }
  const tenantId = tenant._id;

  // Find Carlos's technician record
  const technician = await db.collection('technicians').findOne({ 
    email: 'carlos.rodriguez@crm.com', 
    tenantId,
    deletedAt: null 
  });

  if (!technician) {
    console.error('❌ Technician not found.');
    process.exit(1);
  }

  console.log(`👤 Carlos Rodríguez (${technician._id})`);

  // Get any technical visits that are not completed
  const tvToAssign = await db.collection('technicalvisits')
    .find({ 
      tenantId, 
      deletedAt: null,
      status: { $ne: 'completed' }
    })
    .limit(5)
    .toArray();

  console.log(`\n🔧 Found ${tvToAssign.length} technical visits to assign to Carlos:`);

  for (const tv of tvToAssign) {
    await db.collection('technicalvisits').updateOne(
      { _id: tv._id },
      { 
        $set: { 
          status: 'scheduled',
          assignedTechnicianId: technician._id,
          updatedAt: new Date(),
        } 
      }
    );
    console.log(`   ✅ VT #${tv.visitNumber}: ${tv.title}`);
  }

  // If no technical visits exist, create some
  if (tvToAssign.length === 0) {
    console.log('\n⚠️  No technical visits found. Creating sample visits...');
    
    const user = await db.collection('users').findOne({ email: 'carlos.rodriguez@crm.com' });
    
    const now = new Date();
    const visits = [
      {
        tenantId,
        leadId: null,
        clientId: null,
        clientSnapshot: { name: 'TechCorp Chile S.A.', email: 'contacto@techcorp.cl', phone: '+562 2123 4567' },
        locationSnapshot: { name: 'Oficina Principal', address: 'Av. Providencia 1234', city: 'Santiago' },
        visitNumber: 'TV-CARLOS-001',
        title: 'Inspección inicial de sistema de aire acondicionado',
        description: 'Visita de evaluación para nuevo contrato de mantenimiento',
        scheduledDate: now,
        scheduledStart: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        status: 'scheduled',
        priority: 'normal',
        category: 'inspection',
        assignedTechnicianId: technician._id,
        createdBy: user._id,
        updatedBy: user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        tenantId,
        leadId: null,
        clientId: null,
        clientSnapshot: { name: 'Servicios Integrales del Sur', email: 'info@sisur.cl', phone: '+564 1234 5678' },
        locationSnapshot: { name: 'Bodega', address: 'Camino Lonqueche 567', city: 'Melipilla' },
        visitNumber: 'TV-CARLOS-002',
        title: 'Presupuesto para instalación de equipos',
        description: 'Evaluación técnica para cotizar instalación de 3 equipos de AA',
        scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        scheduledStart: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        status: 'scheduled',
        priority: 'high',
        category: 'budget',
        assignedTechnicianId: technician._id,
        createdBy: user._id,
        updatedBy: user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        tenantId,
        leadId: null,
        clientId: null,
        clientSnapshot: { name: 'Clínica Alemana', email: 'mantencion@alemana.cl', phone: '+562 2210 1111' },
        locationSnapshot: { name: 'Pañol Equipos', address: 'Av. Las Condes 8700', city: 'Santiago' },
        visitNumber: 'TV-CARLOS-003',
        title: 'Evaluación de emergencia - equipo no funciona',
        description: 'Cliente reporta que equipo de frío no enfría correctamente',
        scheduledDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        scheduledStart: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
        status: 'confirmed',
        priority: 'urgent',
        category: 'assessment',
        assignedTechnicianId: technician._id,
        createdBy: user._id,
        updatedBy: user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    await db.collection('technicalvisits').insertMany(visits);
    console.log(`   ✅ Created ${visits.length} sample technical visits`);
  }

  // Check if we need to create more Work Orders
  const currentWO = await db.collection('workorders').countDocuments({
    tenantId,
    assignedTechnicians: technician._id,
    deletedAt: null,
  });

  if (currentWO < 3) {
    console.log('\n📋 Creating sample Work Orders for Carlos...');
    
    const user = await db.collection('users').findOne({ email: 'carlos.rodriguez@crm.com' });
    const clients = await db.collection('clients').find({ tenantId, deletedAt: null }).limit(3).toArray();
    
    const woTemplate = {
      tenantId,
      clientId: null,
      locationId: null,
      leadId: null,
      equipmentId: null,
      quoteId: null,
      clientSnapshot: { name: '', email: '', phone: '', customerType: 'commercial', status: 'active' },
      locationSnapshot: { name: '', address: '', city: '', province: '', country: 'CL' },
      equipmentSnapshot: null,
      contractSnapshot: null,
      source: 'manual',
      priority: 'normal',
      category: 'maintenance',
      status: 'assigned',
      version: 1,
      assignedTechnicians: [technician._id],
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const now = new Date();
    const workOrders = [
      {
        ...woTemplate,
        workOrderNumber: 'WO-CARLOS-001',
        title: 'Mantenimiento preventivo - Sistema de climatización',
        description: 'Cambio de filtros y limpieza de unidades',
        scheduledDate: now.toISOString().split('T')[0],
        scheduledStart: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        clientSnapshot: { name: 'TechCorp Chile S.A.', email: 'contacto@techcorp.cl', phone: '+562 2123 4567', customerType: 'commercial', status: 'active' },
        locationSnapshot: { name: 'Oficina Principal', address: 'Av. Providencia 1234', city: 'Santiago', province: 'Metropolitana', country: 'CL' },
      },
      {
        ...woTemplate,
        workOrderNumber: 'WO-CARLOS-002',
        title: 'Reparación de equipo de refrigeración',
        description: 'Equipo no enfría correctamente - revisión de gas refrigerante',
        scheduledDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scheduledStart: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        clientSnapshot: { name: 'Clínica Alemana', email: 'mantencion@alemana.cl', phone: '+562 2210 1111', customerType: 'commercial', status: 'active' },
        locationSnapshot: { name: 'Pañol Equipos', address: 'Av. Las Condes 8700', city: 'Santiago', province: 'Metropolitana', country: 'CL' },
        priority: 'high',
      },
      {
        ...woTemplate,
        workOrderNumber: 'WO-CARLOS-003',
        title: 'Instalación de nuevo equipo Split',
        description: 'Instalación de equipo de 12000 BTU en sala de reuniones',
        scheduledDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scheduledStart: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        scheduledEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        clientSnapshot: { name: 'Constructora Almagro', email: 'obras@almagro.cl', phone: '+562 2987 6543', customerType: 'commercial', status: 'active' },
        locationSnapshot: { name: 'Obra en curso', address: 'Av. Nueva Bilbao 2345', city: 'Santiago', province: 'Metropolitana', country: 'CL' },
        priority: 'normal',
        category: 'installation',
      },
    ];

    for (const wo of workOrders) {
      await db.collection('workorders').insertOne(wo);
      console.log(`   ✅ Created WO #${wo.workOrderNumber}: ${wo.title}`);
    }
  }

  // Final summary
  console.log('\n📊 Asignaciones finales de Carlos Rodríguez:');

  const finalWO = await db.collection('workorders').countDocuments({
    tenantId,
    assignedTechnicians: technician._id,
    deletedAt: null,
  });

  const finalTV = await db.collection('technicalvisits').countDocuments({
    tenantId,
    assignedTechnicianId: technician._id,
    deletedAt: null,
  });

  console.log(`   📋 Órdenes de Trabajo: ${finalWO}`);
  console.log(`   🔧 Visitas Técnicas: ${finalTV}`);

  console.log('\n✅ Setup complete!\n');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});