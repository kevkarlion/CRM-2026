import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

/**
 * POST /api/crm/clients/[id]/schedule-visit
 * Marca el cliente con estado "visita técnica programada"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Actualizar estado de operación
    const updatedClient = await ClientModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          operationStatus: 'visit_scheduled',
          operationStatusUpdatedAt: new Date(),
        } 
      },
      { new: true }
    );

    console.log('[schedule-visit] Cliente actualizado:', id, 'operationStatus:', updatedClient?.operationStatus);

    return NextResponse.json({ 
      success: true, 
      operationStatus: updatedClient?.operationStatus
    });
  } catch (error: any) {
    console.error('[schedule-visit] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
