import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import TimelineEventModel from '@/timeline/models/timeline-event';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    // Resolve visitId from param
    const { TechnicalVisitModel } = await import('@/operations/models/technical-visit');
    const { Types } = await import('mongoose');
    
    let visitId: string;
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      const vt = await TechnicalVisitModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
      if (vt) {
        visitId = id;
      } else {
        // Try as visitNumber
        const vtByNumber = await TechnicalVisitModel.findOne({ visitNumber: id, tenantId, deletedAt: null }).select('_id').lean();
        if (!vtByNumber) {
          return NextResponse.json({ error: 'TechnicalVisit not found' }, { status: 404 });
        }
        visitId = String(vtByNumber._id);
      }
    } else {
      const vtByNumber = await TechnicalVisitModel.findOne({ visitNumber: id, tenantId, deletedAt: null }).select('_id').lean();
      if (!vtByNumber) {
        return NextResponse.json({ error: 'TechnicalVisit not found' }, { status: 404 });
      }
      visitId = String(vtByNumber._id);
    }

    // Fetch timeline events for this technical visit
    const events = await TimelineEventModel.find({
      tenantId,
      entityType: 'TechnicalVisit',
      entityId: visitId,
    })
      .sort({ createdAt: 1 })
      .populate('performedBy', 'name email')
      .lean();

    return NextResponse.json({ data: events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
