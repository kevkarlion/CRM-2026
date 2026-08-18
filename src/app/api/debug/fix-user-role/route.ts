import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import RoleModel from '@/src/core/models/role';
import UserRoleModel from '@/src/core/models/user-role';
import mongoose from 'mongoose';

// Temporary route to fix missing user role
// DELETE AFTER USE

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { userId, tenantId, roleName = 'admin' } = await request.json();
    
    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'userId and tenantId required' }, { status: 400 });
    }
    
    // Find role
    const role = await RoleModel.findOne({ 
      name: roleName, 
      tenantId: new mongoose.Types.ObjectId(tenantId) 
    });
    
    if (!role) {
      return NextResponse.json({ error: `Role "${roleName}" not found` }, { status: 404 });
    }
    
    // Check existing
    const existing = await UserRoleModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      roleId: role._id,
    });
    
    if (existing) {
      return NextResponse.json({ message: 'Role already assigned', roleId: role._id });
    }
    
    // Create
    const userRole = await UserRoleModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      roleId: role._id,
    });
    
    return NextResponse.json({ success: true, userRole });
  } catch (error) {
    console.error('[fix-role] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}