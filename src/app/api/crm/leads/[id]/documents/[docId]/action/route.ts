import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { QuoteService, ValidationError } from '@/quotes/services/quote.service';
import DocumentModel from '@/documents/models/document';

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

    // Get current lead status
    const LeadModel = (await import('@/leads/models/lead')).default;
    const currentLead = await LeadModel.findById(leadId).select('status').lean();
    const currentStatus = currentLead?.status;
    
    console.log('[document-action] Current status:', currentStatus, '-> action:', action);

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
    } else if (action === 'won') {
      // Mark as direct sale (draft -> direct_sale)
      await quoteService.markAsDirectSale(quoteId, userId, tenantId);
      
      // Solo cambiar lead a won
      // La creación de cliente, gestión y OT se hace en "Resolver"
      await LeadModel.findByIdAndUpdate(leadId, {
        $set: {
          status: 'won',
          updatedBy: userId || 'admin-action',
        },
      });
      
      console.log('[document-action] Lead marcado como won:', leadId);
    }
    
    return NextResponse.json({
      success: true,
      quoteId,
      leadId,
      newStatus: action === 'quote_sent' ? 'quote_sent' : 'won',
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
