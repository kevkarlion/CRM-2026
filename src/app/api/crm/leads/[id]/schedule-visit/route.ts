import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST /api/crm/leads/[id]/schedule-visit
 * Marca el lead como "visita técnica programada" cambiando su estado a technical_visit
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

    // Estados válidos para programar visita técnica
    const validStatuses = ['new', 'contacted', 'quote_sent', 'negotiation'];
    
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: `No se puede programar visita técnica desde estado '${lead.status}'. Estados válidos: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Actualizar estado a technical_visit
    const updatedLead = await LeadModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          status: 'technical_visit',
          updatedBy: 'admin-action'
        } 
      },
      { new: true }
    );

    console.log('[schedule-visit] Lead actualizado:', id, 'nuevo estado:', updatedLead?.status);

    return NextResponse.json({ 
      success: true, 
      lead: {
        _id: String(updatedLead?._id),
        status: updatedLead?.status
      }
    });
  } catch (error: any) {
    console.error('[schedule-visit] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
