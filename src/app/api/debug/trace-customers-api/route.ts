import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * Debug: trace customers API logic step by step
 * GET /api/debug/trace-customers-api
 */
export async function GET() {
  try {
    await connectDB();
    const tenantIdObj = new Types.ObjectId('6a45a83e202f4857cebf0e72');
    const phone = '5492984252859';
    
    // Step 1: Get Kevin as client
    const client = await ClientModel.findOne({ phone: phone }).lean();
    
    // Step 2: Get active conversations for this phone
    const activeConversations = await ConversationModel.find({
      tenantId: tenantIdObj,
      phoneNumber: phone,
      conversationType: 'customer',
      lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
    }).lean();
    
    // Step 3: Get last inbound message
    const lastInbound = await WhatsAppMessageModel.findOne({
      tenantId: tenantIdObj,
      phone: phone,
      direction: 'inbound',
    }).sort({ createdAt: -1 }).lean();
    
    return NextResponse.json({
      phone,
      clientFound: !!client,
      clientId: client?._id,
      activeConversationsCount: activeConversations.length,
      activeConvs: activeConversations.map(c => ({
        _id: c._id,
        lifecycleState: c.lifecycleState,
        lastMessageAt: c.lastMessageAt,
      })),
      lastInbound: lastInbound ? {
        createdAt: lastInbound.createdAt,
        content: lastInbound.content?.substring(0, 30),
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
