import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { TechnicianModel } from '@/operations/models/technician';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const technicians = await TechnicianModel.find({
      tenantId: new (await import('mongoose')).Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .select('_id name email phone')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ data: technicians });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}