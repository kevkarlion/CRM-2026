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
    
    // Get current lead status (just for logging purposes now)
    const LeadModel = (await import('@/leads/models/lead')).default;
    const currentLead = await LeadModel.findById(leadId).select('status').lean();
    const currentStatus = currentLead?.status;
    
    console.log('[document-action] Current status:', currentStatus, '-> new status will be:', newLeadStatus);

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
    
    // Handle quote status based on action
    if (action === 'quote_sent') {
      // Send the quote (draft -> sent)
      // sendQuote automatically updates lead status to 'quote_sent' when first quote is sent
      await quoteService.sendQuote(quoteId, userId, tenantId);
    } else if (action === 'won') {
      // Mark as direct sale (draft -> direct_sale)
      await quoteService.markAsDirectSale(quoteId, userId, tenantId);
      
      // Now call the existing confirm-sale-pdf logic to create client + OT + update lead
      // This ensures single source of truth for client/OT creation
      const LeadModel = (await import('@/leads/models/lead')).default;
      const ClientModel = (await import('@/crm/models/client')).default;
      const WorkOrderModel = (await import('@/operations/models/work-order')).default;
      const { getNextWorkOrderNumber } = await import('@/operations/helpers/counter');
      
      const leadData = await LeadModel.findOne({
        _id: new mongoose.Types.ObjectId(leadId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      }).lean();
      
      if (!leadData) {
        throw new Error('Lead no encontrado');
      }
      
      // Check if already converted (avoid duplicate)
      if ((leadData as any).convertedToClient) {
        return NextResponse.json({
          success: true,
          quoteId,
          leadId,
          newStatus: 'won',
          alreadyConverted: true,
        });
      }
      
      // Create client from lead
      const [client] = await ClientModel.create([{
        tenantId: new mongoose.Types.ObjectId(tenantId),
        customerType: (leadData as any).customerType || 'residential',
        fullName: (leadData as any).name,
        companyName: (leadData as any).companyName,
        email: (leadData as any).email,
        phone: (leadData as any).phone,
        status: 'active',
        source: (leadData as any).source,
        address: (leadData as any).address,
        locality: (leadData as any).locality,
        province: (leadData as any).province,
        notes: 'Cliente creado desde documento PDF',
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
      }]);
      
      // Update lead: won + converted to client
      await LeadModel.findByIdAndUpdate(leadId, {
        $set: {
          status: 'won',
          convertedToClient: client._id,
          convertedAt: new Date(),
          updatedBy: userId || 'admin-action',
        },
      });
      
      // NOTE: No se crea Gestion aquí. Se crea cuando el usuario hace click en "Resuelto"
      
      // Get client name for work order
      const clientName = (leadData as any).companyName || (leadData as any).name || 'Cliente';
      
      // Create work order in draft status
      const tenantPrefix = tenantId.slice(-6);
      const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);
      
      const [workOrder] = await WorkOrderModel.create([{
        tenantId: new mongoose.Types.ObjectId(tenantId),
        clientId: client._id,
        leadId: new mongoose.Types.ObjectId(leadId),
        quoteId: new mongoose.Types.ObjectId(quoteId),
        clientSnapshot: {
          name: clientName,
          email: (leadData as any).email,
          phone: (leadData as any).phone,
          companyName: (leadData as any).companyName || '',
          customerType: (leadData as any).customerType || 'residential',
          status: 'active',
        },
        locationSnapshot: {
          name: clientName,
          address: (leadData as any).address || '',
        },
        source: 'direct_sale',
        category: 'installation',
        workOrderNumber,
        title: `Venta: ${clientName}`,
        description: `Venta generada desde documento PDF`,
        status: 'draft',
        priority: 'normal',
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(),
      }]);
      
      // Link the work order to the quote so decision engine knows it exists
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
        client: { _id: String(client._id) },
        workOrder: { _id: String(workOrder._id), workOrderNumber, status: 'draft' },
      });
    }
    
    // For quote_sent: status is updated automatically by sendQuote
    return NextResponse.json({
      success: true,
      quoteId,
      leadId,
      newStatus: 'quote_sent',
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