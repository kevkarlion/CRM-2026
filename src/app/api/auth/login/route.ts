import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/core/auth/jwt-provider';
import { connectDB } from '@/core/db';
import UserModel from '@/core/models/user';

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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration: JWT_SECRET not set' }, { status: 500 });
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0 } },
    );

    const token = generateToken(
      {
        userId: user._id.toString(),
        tenantId: user.tenantId.toString(),
        roles: [],
      },
      secret,
    );

    const response = NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: [],
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
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
