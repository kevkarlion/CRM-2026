import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { TechnicianModel } from '@/operations/models/technician';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 401 },
      );
    }

    const technician = await TechnicianModel.findOne({
      userId: new Types.ObjectId(userId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .select('_id name email phone specialties')
      .lean();

    if (!technician) {
      return NextResponse.json(
        { error: 'No technician profile found for this user' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: technician });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
