import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';
import { normalizePhone, phoneMatchQuery } from '@/lib/phone';

/**
 * GET /api/crm/leads/by-phone/[phone]
 * Busca un lead por número de teléfono
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    const normalizedPhone = normalizePhone(phone);

    // Buscar lead por teléfono (el más reciente, cualquier estado excepto lost/disqualified)
    const lead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: phoneMatchQuery(normalizedPhone),
      status: { $nin: ['lost', 'disqualified'] },
      deletedAt: null,
    }).sort({ createdAt: -1 }).lean();

    if (!lead) {
      return NextResponse.json({ lead: null });
    }

    return NextResponse.json({ 
      lead: {
        _id: String(lead._id),
        status: lead.status,
        name: lead.name,
        companyName: lead.companyName,
      }
    });
  } catch (error: any) {
    console.error('[leads/by-phone] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
