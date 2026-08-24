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

    // Get latest Gestion for this client (active or closed)
    // Show the most recent one so user always sees current status
    const latestGestion = await GestionModel.findOne({
      clientId: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    }).sort({ createdAt: -1 }).lean();

    // Get ALL gestions for this client (for history/cycles tab)
    const allGestions = await GestionModel.find({
      clientId: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    }).sort({ createdAt: -1 }).lean();

    // Return client with latest Gestion info + all gestions for history
    return NextResponse.json({
      ...client,
      activeGestion: latestGestion ? {
        _id: String(latestGestion._id),
        status: latestGestion.status,
        name: latestGestion.name,
        createdAt: latestGestion.createdAt,
        score: latestGestion.score,
        temperature: latestGestion.temperature,
        inquiryReason: latestGestion.inquiryReason,
        estimatedValue: latestGestion.estimatedValue,
        notes: latestGestion.notes,
        adminNotes: latestGestion.adminNotes,
        events: (latestGestion.events || []).sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      } : null,
      gestions: allGestions.map(g => ({
        _id: String(g._id),
        status: g.status,
        name: g.name,
        source: g.source,
        createdAt: g.createdAt,
        score: g.score,
        temperature: g.temperature,
        inquiryReason: g.inquiryReason,
        estimatedValue: g.estimatedValue,
        notes: g.notes,
        adminNotes: g.adminNotes,
        events: g.events || [],
        history: g.history || [],
      })),
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