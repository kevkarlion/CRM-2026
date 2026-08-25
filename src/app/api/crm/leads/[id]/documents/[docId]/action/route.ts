import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { QuoteService, ValidationError } from '@/quotes/services/quote.service';
import DocumentModel from '@/documents/models/document';
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';

const quoteService = new QuoteService();

type DocumentAction = 'quote_sent' | 'won';

interface DocumentActionBody {
  action: DocumentAction;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    await connectDB();
    const { id: leadId, docId: documentId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as DocumentActionBody;
    const { action } = body;

    if (!action || !['quote_sent', 'won'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "quote_sent" or "won"' },
        { status: 400 }
      );
    }

    // Validate document exists and belongs to this lead
    const document = await DocumentModel.findOne({
      _id: new mongoose.Types.ObjectId(documentId),
      leadId: new mongoose.Types.ObjectId(leadId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or does not belong to this lead' },
        { status: 404 }
      );
    }

    // Get lead data
    const LeadModel = (await import('@/leads/models/lead')).default;
    const lead = await LeadModel.findById(leadId);
    const leadName = lead?.name || lead?.companyName || 'Lead';

    console.log('[document-action] Lead:', leadName, '-> action:', action);

    // Create quote with sourceDocumentId reference
    const quoteInput = {
      leadId,
      sourceDocumentId: documentId,
      title: document.title || `Presupuesto desde documento`,
      description: `Documento de origen: ${document.title || document.filename}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [
        {
          description: 'Item generado automáticamente desde documento',
          type: 'service' as const,
          quantity: 1,
          unitPrice: 0,
        },
      ],
    };

    const quoteResult = await quoteService.createQuote(quoteInput, userId, tenantId);
    const quoteId = String(quoteResult.quote._id);

    // Handle quote status based on action
    if (action === 'quote_sent') {
      // Send the quote (draft -> sent)
      await quoteService.sendQuote(quoteId, userId, tenantId);

      return NextResponse.json({
        success: true,
        quoteId,
        leadId,
        newStatus: 'quote_sent',
      });
    }

    // action === 'won'
    // Mark as direct sale (draft -> direct_sale)
    await quoteService.markAsDirectSale(quoteId, userId, tenantId);

    // Change lead to won
    await LeadModel.findByIdAndUpdate(leadId, {
      $set: {
        status: 'won',
        updatedBy: userId || 'admin-action',
      },
    });

    console.log('[document-action] Lead marked as won:', leadId);

    // Create Work Order in draft status
    const tenantPrefix = tenantId.slice(-6);
    const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);

    const [workOrder] = await WorkOrderModel.create([{
      tenantId: new mongoose.Types.ObjectId(tenantId),
      clientId: null,
      leadId: new mongoose.Types.ObjectId(leadId),
      quoteId: new mongoose.Types.ObjectId(quoteId),
      clientSnapshot: {
        name: leadName,
        email: lead?.email || '',
        phone: lead?.phone || '',
        companyName: lead?.companyName || '',
        customerType: lead?.customerType || 'residential',
        status: 'active',
      },
      locationSnapshot: {
        name: leadName,
        address: lead?.address || '',
      },
      source: 'direct_sale',
      category: 'installation',
      workOrderNumber,
      title: `Venta: ${leadName}`,
      description: `Venta generada desde documento PDF para lead #${leadId}`,
      status: 'draft',
      priority: 'normal',
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
      updatedBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
    }]);

    console.log('[document-action] WorkOrder created:', workOrder._id, 'workOrderNumber:', workOrderNumber);

    // Link work order to quote
    const QuoteModel = (await import('@/quotes/models/quote')).default;
    await QuoteModel.updateOne(
      { _id: new mongoose.Types.ObjectId(quoteId) },
      { $set: { convertedToWorkOrder: workOrder._id } }
    );

    return NextResponse.json({
      success: true,
      quoteId,
      leadId,
      newStatus: 'won',
      workOrder: {
        _id: String(workOrder._id),
        workOrderNumber,
        status: 'draft',
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    console.error('[document-action] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
