import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { Types } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, LeadStatusChangedPayload } from '@/infrastructure/events/event.types';
import { technicalVisitService } from '@/operations/services/technical-visit.service';

interface CreateVisitInput {
  leadId: string;
  serviceTypeId: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  description?: string;
  observations?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateVisitInput;
    const { leadId, scheduledDate, scheduledTime, address, description, observations, priority, contactName, contactPhone, contactEmail } = body;

    // Verify lead exists
    const lead = await LeadModel.findOne({ _id: leadId, tenantId, deletedAt: null });
    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}:00`);

    // Create TechnicalVisit via service (publishes VISIT_CREATED event → timeline)
    const visit = await technicalVisitService.create(
      {
        leadId: lead._id,
        clientSnapshot: {
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
        },
        locationSnapshot: {
          name: 'Dirección de visita',
          address: address,
        },
        title: `Visita técnica - ${contactName}`,
        description,
        scheduledDate: new Date(scheduledDate),
        scheduledStart,
        status: 'scheduled',
        priority: priority || 'normal',
        category: 'inspection',
      },
      tenantId,
      userId,
    );

    // Update lead status to technical_visit (direct update + event, no state machine validation)
    // Visits are user-initiated actions that should always advance the lead
    const currentStatus = lead.status as string;
    if (currentStatus !== 'technical_visit') {
      try {
        await LeadModel.updateOne(
          { _id: new Types.ObjectId(leadId), tenantId: new Types.ObjectId(tenantId) },
          { $set: { status: 'technical_visit', updatedBy: userId } },
        );
        await eventBus.publish({
          type: DOMAIN_EVENTS.LEAD_STATUS_CHANGED,
          aggregateId: leadId,
          aggregateType: 'Lead',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            leadId,
            from: currentStatus,
            to: 'technical_visit',
            leadName: lead.name,
          } as LeadStatusChangedPayload,
        });
      } catch (statusError) {
        console.error('[VisitsRoute] Failed to update lead status:', statusError);
      }
    }

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
