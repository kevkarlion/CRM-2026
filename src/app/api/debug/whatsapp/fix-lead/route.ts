import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';

/**
 * POST /api/debug/whatsapp/fix-lead
 * Body: { phone: string, status?: string }
 * 
 * Backfill lead status. Debug only.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { phone, status } = body;

    if (!phone) {
      return NextResponse.json({ error: 'phone required' }, { status: 400 });
    }

    // Dynamic import to avoid model registration issues
    const { default: LeadModel } = await import('@/leads/models/lead');

    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');

    const lead = await LeadModel.findOne({
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    }).sort({ createdAt: -1 });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (status) {
      lead.status = status;
      lead.updatedBy = 'debug-backfill';
      await lead.save();
    }

    return NextResponse.json({
      lead: {
        _id: String(lead._id),
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        score: lead.score,
        temperature: lead.temperature,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
