import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { Types } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';

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
    const { leadId, serviceTypeId, scheduledDate, scheduledTime, address, description, observations, priority, contactName, contactPhone, contactEmail } = body;

    // Verify lead exists
    const lead = await LeadModel.findOne({ _id: leadId, tenantId, deletedAt: null });
    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    // Create work order (visita técnica)
    // Note: We create a draft first, then immediately schedule it
    const workOrderNumber = await getNextWorkOrderNumber(tenantId);

    const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}:00`);

    const [workOrder] = await WorkOrderModel.create([{
      tenantId: new Types.ObjectId(tenantId),
      // For leads without converted client, we create a temporary client reference
      // The client conversion will update this later
      clientId: new Types.ObjectId(), // Placeholder - will be updated on lead conversion
      locationId: new Types.ObjectId(), // Placeholder - will be updated on lead conversion
      clientSnapshot: {
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        status: 'lead',
      },
      locationSnapshot: {
        name: 'Dirección de visita',
        address: address,
      },
      source: 'manual',
      workOrderNumber,
      title: `Visita técnica - ${contactName}`,
      description,
      priority: priority || 'normal',
      category: 'inspection',
      status: 'scheduled',
      scheduledDate: new Date(scheduledDate),
      scheduledStart,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    }]);

    // Update lead status to technical_visit
    await LeadModel.updateOne(
      { _id: leadId, tenantId },
      { 
        $set: { 
          status: 'technical_visit',
          updatedBy: userId,
        } 
      }
    );

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
