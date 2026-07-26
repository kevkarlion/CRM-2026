import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import leadScoringService from '@/leads/services/lead-scoring.service';
import type { InquiryReason, CustomerType } from '@/leads/types/lead';
import { Types } from 'mongoose';

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

          const lead = await LeadModel.create({
            tenantId: new Types.ObjectId('000000000000000000000001'),
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

          responseMessage = `¡Gracias! Un asesor te contactará pronto.\n\nTu clasificación: ${scoringResult.temperature.toUpperCase()}\nPuntaje: ${scoringResult.score}`;
          nextStep = 'initial';
          
          state.leadId = lead._id.toString();
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
