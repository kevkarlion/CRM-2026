import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/core/auth/jwt-provider';
import { connectDB } from '@/core/db';
import UserModel from '@/core/models/user';
import UserRoleModel from '@/core/models/user-role';
import RoleModel from '@/core/models/role';
import { buildDisplayName } from '@/lib/build-display-name';
import { isMaintenanceMode, isMaintenanceBypassEmail } from '@/lib/maintenance';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await request.json() as { email: string; password: string };
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await UserModel.findOne({ email, deletedAt: null });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await UserModel.updateOne(
        { _id: user._id },
        { $inc: { failedLoginAttempts: 1 } },
      );
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    // Check maintenance mode - only allow users with bypass during maintenance
    if (isMaintenanceMode() && !isMaintenanceBypassEmail(email)) {
      console.log(`[Login] Maintenance mode active - denying login for: ${email}`);
      return NextResponse.json(
        { error: 'Sistema en mantenimiento. Intente más tarde.' },
        { status: 503 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration: JWT_SECRET not set' }, { status: 500 });
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0 } },
    );

    const userRoles = await UserRoleModel.find({ userId: user._id, tenantId: user.tenantId, deletedAt: null }).lean();
    console.log('[Login] userRoles:', JSON.stringify(userRoles));
    const roleIds = userRoles.map(ur => ur.roleId);
    console.log('[Login] roleIds:', roleIds);
    const roles = await RoleModel.find({ _id: { $in: roleIds } }).lean();
    console.log('[Login] roles:', JSON.stringify(roles));
    const roleNames = roles.map(r => r.name);
    console.log('[Login] roleNames:', roleNames);

    const token = await generateToken(
      {
        userId: user._id.toString(),
        tenantId: user.tenantId.toString(),
        roles: roleNames,
        name: buildDisplayName(user.firstName, user.lastName, user.email),
        email: user.email,
      },
      secret,
    );

    const response = NextResponse.json({
      token,
      tenantId: user.tenantId.toString(),
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: roleNames,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
