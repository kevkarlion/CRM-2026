import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { followUpMarkService, ConflictError } from '@/crm/services/follow-up-mark.service';
import { broadcastAttentionMarkAdded } from '@/lib/sse-broadcast';
import { CreateFollowUpMarkInput } from '@/crm/types/follow-up-mark';

interface CreateFollowUpMarkBody {
  leadId?: string;
  clientId?: string;
  assignedTo: string;
  note?: string;
}

function validateCreateBody(body: unknown): CreateFollowUpMarkBody & { valid: true } {
  if (!body || typeof body !== 'object') {
    return { valid: false } as never;
  }

  const obj = body as Record<string, unknown>;
  const hasLeadId = obj.leadId !== undefined && obj.leadId !== null;
  const hasClientId = obj.clientId !== undefined && obj.clientId !== null;

  if (!hasLeadId && !hasClientId) {
    return { valid: false } as never;
  }

  if (hasLeadId && hasClientId) {
    return { valid: false } as never;
  }

  if (typeof obj.assignedTo !== 'string' || !obj.assignedTo.trim()) {
    return { valid: false } as never;
  }

  if (obj.note !== undefined && obj.note !== null && typeof obj.note !== 'string') {
    return { valid: false } as never;
  }

  return {
    valid: true,
    leadId: hasLeadId ? (obj.leadId as string) : undefined,
    clientId: hasClientId ? (obj.clientId as string) : undefined,
    assignedTo: obj.assignedTo as string,
    note: obj.note as string | undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Se requiere el header x-tenant-id' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json({ error: 'Se requiere el parámetro userEmail' }, { status: 400 });
    }

    const marks = await followUpMarkService.getMarksForUser(tenantId, userEmail);

    return NextResponse.json(marks);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Se requiere el header x-tenant-id' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Se requiere el header x-user-id' }, { status: 401 });
    }

    const body = await request.json();

    const validation = validateCreateBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Solicitud inválida: debes proporcionar leadId o clientId (no ambos), y assignedTo es requerido' },
        { status: 400 }
      );
    }

    const { leadId, clientId, assignedTo, note } = validation;

    console.log('[follow-up-marks] Creating mark:', { leadId, clientId, assignedTo });

    // Service converts string IDs to ObjectId internally
    const mark = await followUpMarkService.createMark(
      tenantId,
      { leadId, clientId, assignedTo, note } as CreateFollowUpMarkInput & { markedBy: string },
      userId
    );

    // Get target name for broadcast
    let targetName = 'Elemento sin nombre';
    try {
      const { Types } = await import('mongoose');
      if (leadId) {
        const LeadModel = (await import('@/leads/models/lead')).default;
        const lead = await LeadModel.findOne({ _id: new Types.ObjectId(leadId) }).select('name profileName').lean();
        if (lead) {
          targetName = (lead as { profileName?: string; name?: string }).profileName || (lead as { name: string }).name;
        } else {
          console.log('[follow-up-marks] Lead not found:', leadId);
        }
      } else if (clientId) {
        const { default: ClientModel } = await import('@/crm/models/client');
        const client = await ClientModel.findOne({ _id: new Types.ObjectId(clientId) }).select('fullName profileName companyName').lean();
        if (client) {
          targetName = (client as { profileName?: string; fullName?: string; companyName?: string }).profileName ||
                       (client as { fullName?: string }).fullName ||
                       (client as { companyName?: string }).companyName ||
                       'Sin nombre';
        } else {
          console.log('[follow-up-marks] Client not found:', clientId);
        }
      }
    } catch (err) {
      console.error('[follow-up-marks] Error getting target name:', err);
    }

    // DEBUG: Log what we're broadcasting
    console.log('[follow-up-marks] Broadcasting:', { assignedTo, markId: mark._id });

    // Broadcast to all connected clients
    broadcastAttentionMarkAdded({
      userEmail: assignedTo,
      markId: String(mark._id),
      targetType: leadId ? 'lead' : 'client',
      targetId: String(leadId || clientId),
      targetName,
      markedBy: userId,
      markedAt: mark.markedAt.toISOString(),
    });

    return NextResponse.json(mark, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
