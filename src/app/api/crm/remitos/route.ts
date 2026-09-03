import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import RemitoModel from '@/remitos/models/remito';
import DocumentModel from '@/documents/models/document';
import { getNextRemitoNumber } from './counter';
import { ActivityModel } from '@/crm/models';
import { EVENT_TYPES } from '@/crm/types/activity';
import { logActivity } from '@/audit/activity-logger';
import { ActivityAction } from '@/core/types/activity-log';
import TimelineEventModel from '@/timeline/models/timeline-event';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;

    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,  // Find only non-deleted documents
    };

    console.log('[remitos-list] Query:', JSON.stringify(query));

    if (clientId) {
      query.clientId = new mongoose.Types.ObjectId(clientId);
    }
    if (leadId) {
      query.leadId = new mongoose.Types.ObjectId(leadId);
    }

    const remitos = await RemitoModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      data: remitos.map(r => ({
        _id: String(r._id),
        sourceDocumentId: r.sourceDocumentId ? String(r.sourceDocumentId) : undefined,
        status: r.status,
        title: r.title,
        sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('[remitos-list] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, clientId, leadId } = body;

    console.log('[remitos-create] Received:', { documentId, clientId, leadId, tenantId: tenantId?.slice(-6) });

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Validate document exists
    const document = await DocumentModel.findOne({
      _id: new mongoose.Types.ObjectId(documentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if remito already exists for this document
    let remito = await RemitoModel.findOne({
      sourceDocumentId: new mongoose.Types.ObjectId(documentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (remito) {
      // If already sent, just return it
      if (remito.status === 'sent') {
        return NextResponse.json({
          remitoId: String(remito._id),
          status: remito.status,
          alreadySent: true,
        });
      }
    } else {
      // Create new remito
      const remitoNumber = await getNextRemitoNumber(tenantId);
      
      [remito] = await RemitoModel.create([{
        tenantId: new mongoose.Types.ObjectId(tenantId),
        leadId: leadId ? new mongoose.Types.ObjectId(leadId) : undefined,
        clientId: clientId ? new mongoose.Types.ObjectId(clientId) : undefined,
        sourceDocumentId: new mongoose.Types.ObjectId(documentId),
        number: remitoNumber,
        status: 'sent',
        title: document.title || `Remito ${remitoNumber}`,
        description: `Documento de origen: ${document.title || document.filename}`,
        sentAt: new Date(),
        createdBy: new mongoose.Types.ObjectId(userId),
        updatedBy: new mongoose.Types.ObjectId(userId),
      }]);

      console.log('[remitos-create] Created remito:', { _id: remito._id, clientId, documentId });

      // Create activity record
      const entityType = clientId ? 'client' : (leadId ? 'lead' : 'document');
      const entityId = clientId || leadId || documentId;

      await ActivityModel.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        leadId: leadId ? new mongoose.Types.ObjectId(leadId) : undefined,
        entityType,
        entityId: new mongoose.Types.ObjectId(entityId),
        activityType: 'status_change',
        eventType: EVENT_TYPES.REMITO_SENT,
        title: 'Remito enviado',
        description: `Se envió el remito "${document.title || document.filename}" por WhatsApp`,
        performedBy: new mongoose.Types.ObjectId(userId),
        metadata: {
          remitoId: String(remito._id),
          documentId,
          documentTitle: document.title || document.filename,
        },
      });

      // Log to audit activity
      await logActivity({
        tenantId,
        entityType: 'remito',
        entityId: String(remito._id),
        action: 'created' as ActivityAction,
        actorId: userId,
        leadId,
        clientId,
        metadata: {
          documentId,
          documentTitle: document.title || document.filename,
          number: remitoNumber,
          action: 'enviado',
          description: `Remito "${document.title || document.filename}" enviado por WhatsApp el ${new Date().toLocaleString('es-AR')}`,
        },
      });

      // Create timeline event for client activity tab
      const now = new Date();
      now.setHours(now.getHours() - 3); // Argentina timezone
      const formattedDate = now.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      await TimelineEventModel.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        clientId: clientId ? new mongoose.Types.ObjectId(clientId) : undefined,
        leadId: leadId ? new mongoose.Types.ObjectId(leadId) : undefined,
        entityType: 'remito',
        entityId: new mongoose.Types.ObjectId(String(remito._id)),
        eventType: 'remito.sent',
        title: `Remito "${document.title || document.filename}" enviado — ${formattedDate}`,
        description: `Se envió el remito por WhatsApp el ${formattedDate}`,
        icon: '📤',
        color: 'text-emerald-600',
        performedBy: new mongoose.Types.ObjectId(userId),
      });
    }

    return NextResponse.json({
      remitoId: String(remito._id),
      status: remito.status,
    });

  } catch (error) {
    console.error('[remitos-create] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
