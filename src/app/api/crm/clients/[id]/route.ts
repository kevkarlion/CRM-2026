import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import GestionModel from '@/gestion/models/gestion';
import { Types } from 'mongoose';

/**
 * GET /api/crm/clients/[id]
 * Obtiene un cliente por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();
    
    const client = await ClientModel.findOne(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), deletedAt: null }
    ).lean();
    
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Get active Gestion for this client
    const activeGestion = await GestionModel.findOne({
      clientId: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
      status: { $nin: ['won', 'lost'] },
    }).lean();

    // Return client with active Gestion info
    return NextResponse.json({
      ...client,
      activeGestion: activeGestion ? {
        _id: String(activeGestion._id),
        status: activeGestion.status,
        name: activeGestion.name,
        createdAt: activeGestion.createdAt,
      } : null,
    });
  } catch (error: any) {
    console.error('[clients] GET error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/clients/[id]
 * Actualiza un cliente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();
    
    const body = await request.json();
    
    const client = await ClientModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: body },
      { new: true }
    );
    
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(client);
  } catch (error: any) {
    console.error('[clients] PATCH error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}