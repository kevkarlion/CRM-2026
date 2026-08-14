import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { conversationResolver } from '@/conversation/application/conversation-resolver';
import TimelineEventModel from '@/timeline/models/timeline-event';
import { EVENT_TYPES } from '@/crm/types/activity';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';
import { canTransition } from '@/leads/helpers/lead-state-machine';

/**
 * POST /api/crm/conversations/[conversationId]/resolve
 * 
 * Operator marks the conversation as resolved.
 * If the conversation belongs to a Lead, also marks the Lead as disqualified.
 * Starts the 72-hour reuse window.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { conversationId } = await params;
    
    // Get user ID from header (set by auth middleware)
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Find conversation to get clientId and leadId
    const conversation = await ConversationModel.findById(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check tenant access
    if (conversation.tenantId.toString() !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark conversation as resolved
    await conversationResolver.markAsResolved(conversationId, userId);

    // If conversation has a Lead, mark Lead as disqualified
    const leadId = (conversation as any).leadId;
    console.log('[Resolve] LeadId:', leadId, '| ConversationId:', conversationId);
    
    if (leadId) {
      const lead = await LeadModel.findById(leadId);
      console.log('[Resolve] Lead found:', lead ? lead.status : 'not found');
      
      if (lead && lead.status !== 'disqualified') {
        // Check if transition is allowed
        if (canTransition(lead.status as any, 'disqualified')) {
          await LeadModel.findByIdAndUpdate(leadId, {
            $set: { 
              status: 'disqualified',
              updatedBy: userId,
              // Clear qualification status since it's no longer active
              qualificationStatus: 'not_qualified',
            },
          });

          // Create timeline event for Lead disqualification
          await TimelineEventModel.create({
            tenantId: new Types.ObjectId(tenantId),
            leadId: leadId,
            entityType: 'lead',
            entityId: leadId,
            eventType: EVENT_TYPES.LEAD_STATUS_CHANGED,
            title: 'Lead resuelto',
            description: `El lead fue marcado como resuelto/descalificado desde el Pipeline`,
            metadata: {
              conversationId: conversationId,
              previousStatus: lead.status,
              newStatus: 'disqualified',
            },
            performedBy: new Types.ObjectId(userId),
            createdAt: new Date(),
          });
        }
      }
    }

    // Create timeline event if client exists
    const clientId = (conversation as any).clientId;
    if (clientId) {
      await TimelineEventModel.create({
        tenantId: new Types.ObjectId(tenantId),
        clientId: clientId,
        entityType: 'client',
        entityId: clientId,
        eventType: EVENT_TYPES.CLIENT_CONVERSATION_RESOLVED,
        title: 'Atención resuelta',
        description: `La conversación de WhatsApp fue marcada como resuelta`,
        metadata: {
          conversationId: conversationId,
          phoneNumber: conversation.phoneNumber,
        },
        performedBy: new Types.ObjectId(userId),
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation and Lead marked as resolved' 
    });
  } catch (error) {
    console.error('[Resolve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}