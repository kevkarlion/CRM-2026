import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import ActivityModel from '@/crm/models/activity';
import TenantModel from '@/core/models/tenant';
import leadScoringService from '@/leads/services/lead-scoring.service';
import { LeadService } from '@/leads/services/lead.service';
import type { InquiryReason, CustomerType } from '@/leads/types/lead';
import { Types } from 'mongoose';

const leadService = new LeadService();

// Default tenant ID for WhatsApp leads (Demo Corp)
const DEFAULT_TENANT_ID = '6a45a83e202f4857cebf0e72';

interface BotState {
  step: 'initial' | 'inquiry_reason' | 'customer_type' | 'free_text';
  inquiryReason?: InquiryReason;
  customerType?: CustomerType;
  pushName?: string;
  phone?: string;
  leadId?: string;
  temperature?: string;
  score?: number;
  isB2B?: boolean;
}

const botStates = new Map<string, BotState>();

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    
    const body = await req.json();
    
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    
    if (!message || !contact) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp payload structure' },
        { status: 400 }
      );
    }

    const phone = message.from;
    const pushName = contact.profile?.name;
    
    let userResponse = '';
    let buttonPayload = '';
    
    if (message.type === 'text') {
      userResponse = message.text?.body || '';
    } else if (message.type === 'interactive') {
      buttonPayload = message.button?.payload || message.list_reply?.id || '';
      userResponse = message.button?.text || message.list_reply?.title || '';
    }

    console.log('=== WhatsApp Test Webhook ===');
    console.log({ phone, pushName, userResponse, buttonPayload });

    let state: BotState = botStates.get(phone) || {
      step: 'initial',
      pushName,
      phone,
    };

    let responseMessage = '';
    let nextStep = state.step;
    
    switch (state.step) {
      case 'initial':
        responseMessage = '¿Qué necesitas resolver hoy?';
        nextStep = 'inquiry_reason';
        break;
        
      case 'inquiry_reason':
        if (buttonPayload) {
          state.inquiryReason = buttonPayload as InquiryReason;
          responseMessage = '¿Es para tu casa o tu empresa/local?';
          nextStep = 'customer_type';
        } else {
          responseMessage = 'Por favor seleccioná una opción: [Reparación] [Mantenimiento] [Proyecto nuevo]';
        }
        break;
        
      case 'customer_type':
        if (buttonPayload) {
          state.customerType = buttonPayload as CustomerType;

          const scoringResult = leadScoringService.calculateScore({
            pushName: state.pushName,
            inquiryReason: state.inquiryReason,
            customerType: state.customerType,
            messageText: '',
          });

          // 1. Create lead with status 'new'
          const lead = await LeadModel.create({
            tenantId: new Types.ObjectId(DEFAULT_TENANT_ID),
            name: pushName || `Lead WhatsApp ${phone.slice(-4)}`,
            phone,
            source: 'whatsapp',
            status: 'new',
            inquiryReason: state.inquiryReason,
            customerType: state.customerType,
            temperature: scoringResult.temperature,
            score: scoringResult.score,
            isB2B: scoringResult.isB2B,
            scoringBreakdown: scoringResult.breakdown,
            notes: `Clasificación: ${scoringResult.temperature.toUpperCase()} (${scoringResult.score} puntos)`,
            createdBy: 'whatsapp-bot',
            updatedBy: 'whatsapp-bot',
          });

          const leadId = lead._id.toString();

          // 2. Create activity (required for new → contacted transition)
          // WhatsApp is written communication, so activityType = 'email'
          await ActivityModel.create({
            tenantId: new Types.ObjectId(DEFAULT_TENANT_ID),
            entityType: 'lead',
            entityId: new Types.ObjectId(leadId),
            leadId: new Types.ObjectId(leadId),
            activityType: 'email',
            title: 'Primer contacto vía WhatsApp',
            description: `Lead clasificado como ${scoringResult.temperature.toUpperCase()} (${scoringResult.score} puntos). Servicio: ${state.inquiryReason}, Tipo: ${state.customerType}`,
            performedBy: new Types.ObjectId(DEFAULT_TENANT_ID),
            metadata: {
              source: 'whatsapp-bot',
              scoring: scoringResult.breakdown,
              temperature: scoringResult.temperature,
              score: scoringResult.score,
            },
          });

          // 3. Change status from 'new' → 'contacted'
          await leadService.changeStatus(
            leadId,
            'contacted',
            DEFAULT_TENANT_ID,
            DEFAULT_TENANT_ID
          );

          responseMessage = `¡Gracias! Un asesor te contactará pronto.\n\nTu clasificación: ${scoringResult.temperature.toUpperCase()}\nPuntaje: ${scoringResult.score}`;
          nextStep = 'initial';
          
          state.leadId = leadId;
          state.temperature = scoringResult.temperature;
          state.score = scoringResult.score;
          state.isB2B = scoringResult.isB2B;
        } else {
          responseMessage = 'Por favor seleccioná una opción: [Casa] [Empresa/Local]';
        }
        break;
    }

    botStates.set(phone, { ...state, step: nextStep });

    return NextResponse.json({
      status: 'ok',
      phone,
      pushName,
      currentStep: nextStep,
      response: responseMessage,
      ...(state.leadId && {
        leadId: state.leadId,
        scoring: {
          temperature: state.temperature,
          score: state.score,
          isB2B: state.isB2B,
        },
      }),
    }, { status: 200 });

  } catch (error) {
    console.error('Error in WhatsApp test webhook:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET: Debug - fetch lead by ID (no auth required for testing)
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    
    if (!leadId) {
      return NextResponse.json({ error: 'leadId required' }, { status: 400 });
    }

    const lead = await LeadModel.findById(leadId).lean();
    
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      _id: lead._id,
      tenantId: lead.tenantId,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      temperature: lead.temperature,
      score: lead.score,
      isB2B: lead.isB2B,
      inquiryReason: lead.inquiryReason,
      customerType: lead.customerType,
      scoringBreakdown: lead.scoringBreakdown,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
