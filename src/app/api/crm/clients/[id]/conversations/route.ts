import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

/**
 * GET /api/crm/clients/[id]/conversations
 * Devuelve las conversaciones resueltas de un cliente
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    // Verify client exists
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Buscar conversaciones resueltas del cliente por teléfono
    const conversations = await ConversationModel.find({
      tenantId: new Types.ObjectId(tenantId),
      phoneNumber: client.phone,
      conversationType: 'customer',
      lifecycleState: 'RESOLVED',
    })
      .sort({ resolvedAt: -1 })
      .lean();

    return NextResponse.json({ data: conversations });
  } catch (error: any) {
    console.error('[client-conversations] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
