import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST /api/crm/leads/[id]/confirm-sale-pdf
 * Confirma venta directa desde PDF:
 * - Cambia lead.status a 'won'
 * 
 * La creación de cliente, gestión y OT se hace en "Resolver"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    // Estados válidos para confirmar venta
    const validStatuses = ['new', 'contacted', 'quote_sent', 'technical_visit', 'negotiation'];
    
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: `No se puede confirmar venta desde estado '${lead.status}'. Estados válidos: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Solo cambiar lead a won
    // La creación de cliente, gestión y OT se hace en "Resolver"
    await LeadModel.findByIdAndUpdate(id, {
      $set: {
        status: 'won',
        updatedBy: userId || 'admin-action',
      },
    });

    console.log('[confirm-sale-pdf] Lead marcado como won:', id);

    return NextResponse.json({ 
      success: true, 
      lead: {
        _id: String(lead._id),
        status: 'won',
      },
    });
  } catch (error: any) {
    console.error('[confirm-sale-pdf] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
