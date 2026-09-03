import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import whatsappService from '@/crm/services/whatsapp.service';
import '@/crm/models/whatsapp-message';
import '@/leads/models/lead';
import '@/core/models/tenant';
import connectDB from '@/core/db';

/**
 * POST: Simula un mensaje de WhatsApp para testing del bot
 * Body: { phone: "5492984252859", message: "Hola", profileName?: "Juan" }
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    
    const body = await req.json();
    const { phone, message, profileName } = body;
    
    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone and message are required' },
        { status: 400 }
      );
    }
    
    console.log(`🧪 Simulating WhatsApp message from ${phone}: "${message}"`);
    
    // Simular el formato que llega de WhatsApp
    const simulatedMessage = {
      object: 'whatsapp',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '54900000000',
              phone_number_id: '123456789'
            },
            messages: [{
              from: phone,
              id: `sim_${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'text',
              text: {
                body: message
              }
            }],
            contacts: profileName ? [{
              profile: {
                name: profileName
              },
              wa_id: phone
            }] : []
          }
        }]
      }]
    };
    
    // Procesar como si fuera un mensaje real
    const result = await whatsappService.handleIncomingMessage(simulatedMessage);
    
    return NextResponse.json({
      success: true,
      phone,
      message,
      result: result ? 'processed' : 'no response',
      context: result?.context?.data
    });
  } catch (error) {
    console.error('Error simulating message:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Error') },
      { status: 500 }
    );
  }
}
