import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import TimelineEventModel from '@/timeline/models/timeline-event';
import { Types } from 'mongoose';

/**
 * POST /api/crm/conversations/[conversationId]/assign
 *
 * Assigns an operator to a conversation in handoff state.
 * Body: { userId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await req.json() as { userId: string };
    const { userId: assignedUserId } = body;

    if (!assignedUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const conversation = await ConversationModel.findById(
      new Types.ObjectId(conversationId)
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.tenantId.toString() !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (conversation.handoffStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Conversation is not in pending handoff state' },
        { status: 400 }
      );
    }

    // Update conversation: assign operator and move to human_assigned
    await ConversationModel.findByIdAndUpdate(
      new Types.ObjectId(conversationId),
      {
        $set: {
          handoffStatus: 'assigned',
          assignedToUserId: new Types.ObjectId(assignedUserId),
          state: 'human_assigned',
        },
      }
    );

    // Create timeline event for the assignment
    await TimelineEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      entityType: 'lead',
      entityId: conversation.leadId,
      leadId: conversation.leadId,
      eventType: 'note.added',
      title: 'Handoff asignado',
      description: `Operador asignado: ${assignedUserId}`,
      performedBy: new Types.ObjectId(userId),
      metadata: {
        source: 'crm-ui',
        conversationId,
        assignedUserId,
        handoffReason: conversation.handoffReason,
      },
    });

    return NextResponse.json({
      success: true,
      conversationId,
      assignedUserId,
      handoffStatus: 'assigned',
      state: 'human_assigned',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
