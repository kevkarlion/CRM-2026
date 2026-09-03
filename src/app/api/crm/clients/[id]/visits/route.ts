import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import { technicalVisitService } from '@/operations/services/technical-visit.service';

interface CreateVisitInput {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: clientId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateVisitInput;
    const { scheduledDate, scheduledTime, address, description, observations, priority, contactName, contactPhone, contactEmail } = body;

    // Verify client exists
    const client = await ClientModel.findOne({
      _id: clientId,
      tenantId,
      deletedAt: null,
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (client.status === 'blocked') {
      return NextResponse.json({ error: 'Cliente bloqueado — no puede operar' }, { status: 409 });
    }

    const clientName = client.companyName || client.fullName || contactName;
    const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}:00`);

    // Create TechnicalVisit via service (publishes VISIT_CREATED event → timeline)
    const visit = await technicalVisitService.create(
      {
        clientId: client._id,
        clientSnapshot: {
          name: clientName,
          email: client.email || contactEmail,
          phone: client.phone || contactPhone,
        },
        locationSnapshot: {
          name: 'Dirección de visita',
          address: address,
        },
        title: `Visita técnica - ${clientName}`,
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

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
