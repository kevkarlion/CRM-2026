import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { QuoteService, ValidationError } from '@/quotes/services/quote.service';
import { LeadService, ConflictError } from '@/leads/services/lead.service';
import DocumentModel from '@/documents/models/document';

const quoteService = new QuoteService();
const leadService = new LeadService();

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

    // Determine new lead status based on action
    const newLeadStatus = action === 'quote_sent' ? 'quote_sent' : 'won';
    
    // Get current lead status to check if transition is needed
    const LeadModel = (await import('@/leads/models/lead')).default;
    const currentLead = await LeadModel.findById(leadId).select('status').lean();
    const currentStatus = currentLead?.status;
    
    // Validate transition - skip if already in target status
    const terminalStatuses = ['won', 'lost', 'disqualified'];
    const invalidTransitions: Record<string, string[]> = {
      new: ['new'],
      contacted: ['contacted'],
      quote_sent: ['quote_sent'],
      negotiation: ['negotiation'],
      technical_visit: ['technical_visit'],
      qualified: ['qualified'],
      won: ['won'],
      lost: ['lost'],
      disqualified: ['disqualified'],
    };
    
    // Allow if: status is different OR status is terminal (we can still create quotes)
    const needsStatusUpdate = currentStatus !== newLeadStatus && !terminalStatuses.includes(currentStatus || '');

    // Create quote with sourceDocumentId reference
    // Use the document title as the quote title, add placeholder item for now
    const quoteInput = {
      leadId,
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
    
    // Send or approve the quote based on action
    // This bypasses the normal flow - documents come from external system so they go directly to sent/approved
    if (action === 'quote_sent') {
      // Just send the quote (draft -> sent)
      await quoteService.sendQuote(quoteId, userId, tenantId);
    } else if (action === 'won') {
      // Send first, then approve (draft -> sent -> approved)
      await quoteService.sendQuote(quoteId, userId, tenantId);
      await quoteService.approveQuote(quoteId, userId, tenantId);
    }

    // Only update lead status if needed and not already in terminal state
    if (needsStatusUpdate) {
      await leadService.changeStatus(leadId, newLeadStatus as any, userId, tenantId);
    }

    return NextResponse.json({
      success: true,
      quoteId,
      leadId,
      newStatus: needsStatusUpdate ? newLeadStatus : currentStatus,
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