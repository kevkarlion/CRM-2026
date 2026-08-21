import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { TenantModel, UserModel, RoleModel, UserRoleModel } from '@/core/models';

// DELETE method
export async function DELETE(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'dev-admin-2026' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Delete user roles first
    await UserRoleModel.deleteMany({ userId: user._id });
    
    // Delete user
    await UserModel.deleteOne({ _id: user._id });

    return NextResponse.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}

// POST method
export async function POST(request: NextRequest) {
  // Allow in development or with secret
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'dev-admin-2026' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const { email, password, firstName, lastName, role, action, tenantId } = await request.json();

    // Buscar tenant - puede ser demo o el tenant especificado
    let tenant;
    if (tenantId) {
      tenant = await TenantModel.findById(new mongoose.Types.ObjectId(tenantId));
    } else {
      tenant = await TenantModel.findOne({ slug: 'demo' });
    }
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado. Ejecutá el seed primero.' }, { status: 400 });
    }

    // Buscar o crear rol
    let userRole = await RoleModel.findOne({ name: role || 'admin', tenantId: tenant._id });
    if (!userRole) {
      userRole = await RoleModel.create({
        tenantId: tenant._id,
        name: role || 'admin',
        permissions: ['*'],
        description: 'Admin role',
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await UserModel.findOne({ email, tenantId: tenant._id });
    
    // Si action es update y existe, actualizar
    if (action === 'update' && existingUser) {
      const updateData: Record<string, any> = { updatedBy: 'manual' };
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
      
      await UserModel.updateOne({ _id: existingUser._id }, { $set: updateData });
      
      return NextResponse.json({
        success: true,
        message: 'Usuario actualizado',
        user: { email: existingUser.email, firstName, lastName }
      });
    }

    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }

    // Crear usuario
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      tenantId: tenant._id,
      email,
      passwordHash,
      firstName: firstName || 'Admin',
      lastName: lastName || 'User',
      status: 'active',
      createdBy: 'manual',
      updatedBy: 'manual',
    });

    // Asignar rol
    await UserRoleModel.create({
      tenantId: tenant._id,
      userId: newUser._id,
      roleId: userRole._id,
      assignedBy: newUser._id,
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario creado',
      user: { email: newUser.email, firstName: newUser.firstName }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
