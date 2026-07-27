import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import chatService from '@/crm/services/chat.service';

/**
 * GET /api/debug/whatsapp/conversations-auth
 * Like /api/crm/whatsapp/conversations but with debug info
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    const auth = req.headers.get('authorization');

    console.log('[Debug] x-tenant-id:', tenantId);
    console.log('[Debug] Authorization:', auth?.slice(0, 20) + '...');

    if (!tenantId) {
      return NextResponse.json({ 
        error: 'x-tenant-id header missing',
        receivedHeaders: {
          'x-tenant-id': req.headers.get('x-tenant-id'),
          'authorization': auth ? 'present' : 'missing'
        }
      }, { status: 401 });
    }

    const conversations = await chatService.listConversations(tenantId, { limit: 50 });

    return NextResponse.json({ 
      tenantId,
      conversations 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}