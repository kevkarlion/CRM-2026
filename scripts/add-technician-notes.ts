import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

const MATERIALS_BY_CATEGORY: Record<string, string[]> = {
  installation: ['Cables UTP Cat6', 'Conectores RJ45', 'Patch panel', 'Canaletas', 'Tornillos y tacos'],
  maintenance: ['Lubricante', 'Herramientas básicas', 'Repuestos de respaldo'],
  repair: ['Soldador', 'Estaño', 'Cables de repuesto', 'Multímetro'],
  inspection: ['Linterna', 'Cámara', 'Checklist impreso'],
  warranty: ['Documentación', 'Piezas de repuesto'],
  emergency: ['Herramientas de emergencia', 'Cables de corriente', 'Fusibles'],
};

const TOOLS_BY_CATEGORY: Record<string, string[]> = {
  installation: ['Taladro', 'Destornillador Phillips', 'Crimpeadora RJ45', 'Nivel'],
  maintenance: ['Llaves allen', 'Multímetro digital', 'Espectrómetro'],
  repair: ['Soldador 30W', 'Pinzas de corte', 'Osciloscopio'],
  inspection: ['Cámara termográfica', 'Medidor de tierra', 'Lan tester'],
  warranty: ['Kit de documentación', 'Cámara fotos'],
  emergency: ['Herramienta multiservicio', 'Extensión eléctrica 20m'],
};

const ADDITIONAL_NOTES_EXAMPLES = [
  'Cliente muy exigente, arriver 15 min antes',
  'Zona不安全, ingresar por puerta posterior',
  'El cliente pide que no se use el baño de la casa',
  'Llamar 30 min antes de llegar',
  'El portón está dañado, entrar a pie',
  'Perro agresivo en el patio, tener precaución',
  'El cliente solo acepta pagos transferencia',
  'Tiene garantía vigente, no cobrar adicionales',
];

async function updateWorkOrders() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const db = mongoose.connection.db;
  
  // Get tenant
  const tenant = await db.collection('tenants').findOne({});
  if (!tenant) {
    console.log('❌ No tenant found');
    process.exit(1);
  }
  const tenantId = tenant._id;
  
  console.log('📋 Updating Work Orders for tenant:', tenant.name);
  
  // Get all work orders - use the ObjectId directly
  const workOrders = await db.collection('workorders').find({ tenantId }).toArray();
  
  let updated = 0;
  for (const wo of workOrders) {
    const category = wo.category || 'installation';
    
    // Generate materials based on category
    const materials = MATERIALS_BY_CATEGORY[category]?.join(', ') || 'Materiales estándar';
    const tools = TOOLS_BY_CATEGORY[category]?.join(', ') || 'Herramientas básicas';
    const additionalNotes = ADDITIONAL_NOTES_EXAMPLES[Math.floor(Math.random() * ADDITIONAL_NOTES_EXAMPLES.length)];
    
    // Generate a realistic address based on client
    const clientName = wo.clientSnapshot?.name || 'Cliente';
    const address = `Av. Principal ${Math.floor(Math.random() * 1000) + 1}, Santiago`;
    
    await db.collection('workorders').updateOne(
      { _id: wo._id },
      {
        $set: {
          'technicianNotes.materials': materials,
          'technicianNotes.tools': tools,
          'technicianNotes.additionalNotes': additionalNotes,
          'locationSnapshot.address': address,
          'locationSnapshot.city': 'Santiago',
          'locationSnapshot.province': 'Metropolitana',
        }
      }
    );
    updated++;
  }
  
  console.log(`✅ Updated ${updated} Work Orders`);
  
  // Now update Technical Visits
  console.log('🔧 Updating Technical Visits...');
  
  const visits = await db.collection('technicalvisits').find({ tenantId }).toArray();
  
  let visitsUpdated = 0;
  for (const tv of visits) {
    const category = tv.category || 'inspection';
    
    const materials = MATERIALS_BY_CATEGORY[category]?.join(', ') || 'Materiales estándar';
    const tools = TOOLS_BY_CATEGORY[category]?.join(', ') || 'Herramientas básicas';
    const additionalNotes = ADDITIONAL_NOTES_EXAMPLES[Math.floor(Math.random() * ADDITIONAL_NOTES_EXAMPLES.length)];
    const address = `Calle ${Math.floor(Math.random() * 500) + 1}, Santiago`;
    
    await db.collection('technicalvisits').updateOne(
      { _id: tv._id },
      {
        $set: {
          'technicianNotes.materials': materials,
          'technicianNotes.tools': tools,
          'technicianNotes.additionalNotes': additionalNotes,
          'locationSnapshot.address': address,
          'locationSnapshot.city': 'Santiago',
          'locationSnapshot.province': 'Metropolitana',
        }
      }
    );
    visitsUpdated++;
  }
  
  console.log(`✅ Updated ${visitsUpdated} Technical Visits`);
  
  await mongoose.disconnect();
  console.log('🎉 Done!');
}

updateWorkOrders().catch(console.error);