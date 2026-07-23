import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/core/db';
import { TenantModel, UserModel, RoleModel, UserRoleModel } from '@/core/models';

export async function POST(request: NextRequest) {
  // Solo permitir en desarrollo o con token secreto
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'dev-admin-2026' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    // Buscar o crear tenant
    let tenant = await TenantModel.findOne({ slug: 'demo' });
    if (!tenant) {
      tenant = await TenantModel.create({
        slug: 'demo',
        name: 'Demo Corp',
        status: 'active',
        plan: { type: 'professional', features: { multiUser: true, contracts: true } },
        locale: { country: 'CL', currency: 'CLP', timezone: 'America/Santiago', language: 'es' },
      });
    }

    // Buscar o crear rol admin
    let adminRole = await RoleModel.findOne({ name: 'admin', tenantId: tenant._id });
    if (!adminRole) {
      adminRole = await RoleModel.create({
        tenantId: tenant._id,
        name: 'admin',
        permissions: ['*'],
        description: 'Administrator role',
      });
    }

    // Buscar o crear usuario admin
    let adminUser = await UserModel.findOne({ email: 'admin@demo.com', tenantId: tenant._id });
    if (!adminUser) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      adminUser = await UserModel.create({
        tenantId: tenant._id,
        email: 'admin@demo.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'Demo',
        status: 'active',
        createdBy: 'seed',
        updatedBy: 'seed',
      });

      // Asignar rol admin
      await UserRoleModel.create({
        tenantId: tenant._id,
        userId: adminUser._id,
        roleId: adminRole._id,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created/updated',
      credentials: { email: 'admin@demo.com', password: 'admin123' },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}