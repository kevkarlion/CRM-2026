import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { QuoteService, ValidationError } from '@/quotes/services/quote.service';
import DocumentModel from '@/documents/models/document';
import ClientModel from '@/crm/models/client';
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
    const { id: clientId, docId: documentId } = await params;
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

    // Validate document exists and belongs to this client
    const document = await DocumentModel.findOne({
      _id: new mongoose.Types.ObjectId(documentId),
      clientId: new mongoose.Types.ObjectId(clientId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or does not belong to this client' },
        { status: 404 }
      );
    }

    // Get client data for creating work order
    const client = await ClientModel.findOne({
      _id: new mongoose.Types.ObjectId(clientId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const clientName = client.companyName || client.fullName;

    // Create quote with sourceDocumentId reference
    const quoteInput = {
      clientId,
      sourceDocumentId: documentId,
      title: document.title || `Presupuesto desde documento`,
      description: `Documento de origen: ${document.title || document.filename}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
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
        clientId,
        newStatus: 'sent',
      });
    } 
    
    if (action === 'won') {
      // Mark as direct sale (draft -> direct_sale)
      await quoteService.markAsDirectSale(quoteId, userId, tenantId);
      
      // Create work order in draft status
      const tenantPrefix = tenantId.slice(-6);
      const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);

      const [workOrder] = await WorkOrderModel.create([{
        tenantId: new mongoose.Types.ObjectId(tenantId),
        clientId: client._id,
        quoteId: new mongoose.Types.ObjectId(quoteId),
        clientSnapshot: {
          name: clientName,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName || '',
          customerType: client.customerType || 'residential',
          status: 'active',
        },
        locationSnapshot: {
          name: clientName,
          address: client.address || '',
        },
        source: 'direct_sale',
        category: 'installation',
        workOrderNumber,
        title: `Venta: ${clientName}`,
        description: `Venta generada desde documento PDF para cliente #${client._id}`,
        status: 'draft',
        priority: 'normal',
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
      }]);

      // Link the work order to the quote
      const QuoteModel = (await import('@/quotes/models/quote')).default;
      await QuoteModel.updateOne(
        { _id: new mongoose.Types.ObjectId(quoteId) },
        { $set: { convertedToWorkOrder: workOrder._id } }
      );

      return NextResponse.json({
        success: true,
        quoteId,
        clientId,
        newStatus: 'won',
        workOrder: { _id: String(workOrder._id), workOrderNumber, status: 'draft' },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[client-document-action] Error:', error);
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}