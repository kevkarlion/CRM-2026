import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';

/**
 * GET /api/debug/whatsapp/bot-state?phone=XXXXXXXXXXX
 *
 * Verifica el estado de la conversación y el lead para un teléfono dado.
 * Endpoint público de debug.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const phone = req.nextUrl.searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'phone query param required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');

    // Find lead by phone
    const lead = await LeadModel.findOne({
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    }).sort({ createdAt: -1 });

    if (!lead) {
      return NextResponse.json({ error: 'No lead found for this phone', phone: normalizedPhone }, { status: 404 });
    }

    // Find latest conversation
    const conversation = await ConversationModel.findOne({ leadId: lead._id })
      .sort({ createdAt: -1 });

    // Find messages
    const messages = await WhatsAppMessageModel.find({ leadId: lead._id })
      .sort({ createdAt: 1 })
      .limit(20)
      .select('content direction createdAt type status');

    const BOT_ACTIVE_STATES = [
      'greeting', 'need_type_asked', 'need_type_captured',
      'detail_asked', 'detail_captured', 'urgency_asked', 'urgency_captured',
      'location_asked', 'location_captured', 'equipment_asked', 'equipment_captured',
      'evaluate', 'scored',
    ];

    return NextResponse.json({
      lead: {
        _id: String(lead._id),
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        score: lead.score,
        temperature: lead.temperature,
        source: lead.source,
        inquiryReason: lead.inquiryReason,
        customerType: lead.customerType,
        scoringBreakdown: lead.scoringBreakdown,
        createdAt: lead.createdAt,
      },
      conversation: conversation ? {
        _id: String(conversation._id),
        state: conversation.state,
        previousState: conversation.previousState,
        context: conversation.context,
        step: conversation.step,
        fallbackCount: conversation.fallbackCount,
        exchangesInSameState: conversation.exchangesInSameState,
        handoffStatus: conversation.handoffStatus,
        handoffReason: conversation.handoffReason,
        lastMessageAt: conversation.lastMessageAt,
        startedAt: conversation.startedAt,
        closedAt: conversation.closedAt,
        isBotActive: BOT_ACTIVE_STATES.includes(conversation.state),
      } : null,
      messages: messages.map(m => ({
        content: m.content,
        direction: m.direction,
        createdAt: m.createdAt,
        type: m.type,
      })),
      summary: {
        hasConversation: !!conversation,
        currentState: conversation?.state || 'none',
        isBotActive: conversation ? BOT_ACTIVE_STATES.includes(conversation.state) : false,
        isHandoffPending: conversation?.handoffStatus === 'pending',
        messageCount: messages.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
