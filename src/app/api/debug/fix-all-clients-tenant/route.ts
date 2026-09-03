import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

/**
 * Fix: check and fix all clients with conversations in wrong tenant
 * POST /api/debug/fix-all-clients-tenant
 */
export async function POST() {
  try {
    await connectDB();
    
    const correctTenantId = new Types.ObjectId('6a45a83e202f4857cebf0e72');
    
    // Get all clients
    const clients = await ClientModel.find({}).lean();
    
    const fixed: any[] = [];
    const alreadyCorrect: any[] = [];
    const noConv: any[] = [];
    
    for (const client of clients) {
      if (!client.phone) continue;
      
      const phone = client.phone.replace(/\D/g, '');
      
      // Find conversations for this phone
      const convs = await ConversationModel.find({
        phoneNumber: phone,
      }).lean();
      
      for (const conv of convs) {
        const convTenantId = String(conv.tenantId);
        const correctTenantIdStr = String(correctTenantId);
        
        if (convTenantId !== correctTenantIdStr && convTenantId !== '000000000000000000000001') {
          // Skip other tenants, only fix default tenant
          continue;
        }
        
        if (convTenantId === '000000000000000000000001') {
          // Fix it
          conv.tenantId = correctTenantId;
          await conv.save();
          fixed.push({
            clientName: client.fullName,
            phone,
            conversationId: conv._id,
          });
        } else if (convTenantId === correctTenantIdStr) {
          alreadyCorrect.push({
            clientName: client.fullName,
            phone,
          });
        }
      }
    }
    
    return NextResponse.json({ 
      fixed: fixed.length,
      alreadyCorrect: alreadyCorrect.length,
      details: { fixed, alreadyCorrect },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to fix all clients tenant' });
}
