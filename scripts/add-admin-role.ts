import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import { connectDB } from '../src/core/db';
import RoleModel from '../src/core/models/role';
import UserRoleModel from '../src/core/models/user-role';

const USER_ID = '6a7f070120b843b932678970';
const TENANT_ID = '6a45a83e202f4857cebf0e72';

async function main() {
  await connectDB();
  
  // Find Administrator role
  const adminRole = await RoleModel.findOne({ 
    name: 'admin', 
    tenantId: new mongoose.Types.ObjectId(TENANT_ID) 
  });
  
  if (!adminRole) {
    console.log('❌ No se encontró rol "admin" para el tenant');
    process.exit(1);
  }
  
  console.log('✅ Rol encontrado:', adminRole._id, adminRole.name);
  
  // Check if UserRole already exists
  const existing = await UserRoleModel.findOne({
    userId: new mongoose.Types.ObjectId(USER_ID),
    tenantId: new mongoose.Types.ObjectId(TENANT_ID),
    roleId: adminRole._id,
  });
  
  if (existing) {
    console.log('⚠️ El usuario ya tiene este rol asignado');
    process.exit(0);
  }
  
  // Create UserRole
  const userRole = await UserRoleModel.create({
    userId: new mongoose.Types.ObjectId(USER_ID),
    tenantId: new mongoose.Types.ObjectId(TENANT_ID),
    roleId: adminRole._id,
  });
  
  console.log('✅ Rol asignado:', userRole._id);
  process.exit(0);
}

main().catch(console.error);