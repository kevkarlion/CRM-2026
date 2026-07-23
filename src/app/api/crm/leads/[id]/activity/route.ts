import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import TimelineEventModel from '@/timeline/models/timeline-event';
import '@/core/models/user'; // Register User model for ref resolution
import { Types } from 'mongoose';

interface TimelineEvent {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  eventType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  performedBy: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: Date;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id: leadId } = await params;

    const events = await TimelineEventModel.find({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('performedBy', 'firstName lastName email')
      .lean() as unknown as TimelineEvent[];

    // Map performedBy → createdBy for frontend compatibility
    const mapped = events.map((e) => ({
      ...e,
      createdBy: e.performedBy,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
