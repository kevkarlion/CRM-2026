import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
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

    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    // Find technician by userId
    const technician = await TechnicianModel.findOne({
      userId: userObjectId,
      tenantId: tenantObjectId,
      deletedAt: null,
    }).lean();

    if (!technician) {
      return NextResponse.json(
        { error: 'No se encontró un técnico asociado a este usuario' },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const search = searchParams.get('search') || undefined;

    const query: Record<string, unknown> = {
      tenantId: tenantObjectId,
      assignedTechnicianId: technician._id,
      deletedAt: null,
    };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'clientSnapshot.name': { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      query.scheduledDate = {};
      if (from) (query.scheduledDate as Record<string, Date>).$gte = new Date(from);
      if (to) (query.scheduledDate as Record<string, Date>).$lte = new Date(to);
    }

    const visits = await TechnicalVisitModel.find(query)
      .populate('assignedTechnicianId', 'name email phone specialties')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .lean() as unknown as Array<{
      _id: Types.ObjectId;
      visitNumber: string;
      title: string;
      description?: string;
      status: string;
      priority: string;
      category: string;
      scheduledDate?: Date;
      scheduledStart?: Date;
      scheduledEnd?: Date;
      clientSnapshot?: { name?: string; email?: string; phone?: string };
      locationSnapshot?: { name?: string; address?: string; city?: string; province?: string };
      assignedTechnicianId?: { _id: Types.ObjectId; name: string; email?: string; phone?: string };
      result?: { findings?: string; recommendation?: string; estimatedBudget?: number; nextSteps?: string };
    }>;

    const data = visits.map((v) => ({
      _id: String(v._id),
      visitNumber: v.visitNumber,
      title: v.title,
      description: v.description,
      status: v.status,
      priority: v.priority,
      category: v.category,
      scheduledDate: v.scheduledDate,
      scheduledStart: v.scheduledStart,
      scheduledEnd: v.scheduledEnd,
      clientSnapshot: v.clientSnapshot,
      locationSnapshot: v.locationSnapshot,
      assignedTechnicianId: v.assignedTechnicianId
        ? {
            _id: String((v.assignedTechnicianId as any)._id),
            name: (v.assignedTechnicianId as any).name,
            email: (v.assignedTechnicianId as any).email,
            phone: (v.assignedTechnicianId as any).phone,
          }
        : null,
      result: v.result,
    }));

    return NextResponse.json({ data, total: data.length, technicianId: String(technician._id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}