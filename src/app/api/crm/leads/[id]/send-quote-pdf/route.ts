import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST /api/crm/leads/[id]/send-quote-pdf
 * Marca el lead como "presupuesto enviado" cambiando su estado a quote_sent
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

    // Estados válidos para enviar presupuesto
    const validStatuses = ['new', 'contacted', 'technical_visit', 'negotiation'];
    
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: `No se puede enviar presupuesto desde estado '${lead.status}'. Estados válidos: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Actualizar estado a quote_sent
    const updatedLead = await LeadModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          status: 'quote_sent',
          updatedBy: 'admin-action'
        } 
      },
      { new: true }
    );

    console.log('[send-quote-pdf] Lead actualizado:', id, 'nuevo estado:', updatedLead?.status);

    return NextResponse.json({ 
      success: true, 
      lead: {
        _id: String(updatedLead?._id),
        status: updatedLead?.status
      }
    });
  } catch (error: any) {
    console.error('[send-quote-pdf] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
