import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import QuoteModel from '@/quotes/models/quote';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import { CommercialProcessService } from '@/crm/services/commercial-process.service';
import { Types } from 'mongoose';
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import type { LeadStatus } from '@/leads/constants/lead-status.constants';

interface ConfirmSaleInput {
  saleMode: 'quotes' | 'direct';
  quoteIds?: string[];
  notes?: string;
  customerType?: string;
  directSale?: {
    amount: number;
    description?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: leadId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as ConfirmSaleInput;
    const { saleMode, quoteIds, notes, customerType, directSale } = body;
    const resolvedCustomerType = customerType || 'commercial';

    // Validar según el modo
    if (saleMode === 'quotes' && (!quoteIds || quoteIds.length === 0)) {
      return NextResponse.json({ error: 'Selecciona al menos un presupuesto' }, { status: 400 });
    }

    if (saleMode === 'direct' && (!directSale || directSale.amount <= 0)) {
      return NextResponse.json({ error: 'Ingresa un monto válido para la venta directa' }, { status: 400 });
    }

    // Get lead
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    const ALLOWED_FOR_SALE: LeadStatus[] = ['contacted', 'technical_visit', 'quote_sent', 'negotiation'];
    if (!ALLOWED_FOR_SALE.includes(lead.status as LeadStatus)) {
      return NextResponse.json(
        { error: `Lead en estado '${lead.status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación` },
        { status: 400 },
      );
    }

    let totalAmount = 0;
    let quotes: Array<{ total: number }> = [];
    let quotesApproved = 0;

    // Procesar según el modo
    if (saleMode === 'quotes' && quoteIds) {
      // Verificar todos los presupuestos pertenecen al lead y están aprobados
      const foundQuotes = await QuoteModel.find({
        _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) },
        leadId: new Types.ObjectId(leadId),
        status: 'approved',
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).lean();

      quotes = foundQuotes as unknown as Array<{ total: number }>;

      if (quotes.length !== quoteIds.length) {
        return NextResponse.json({ error: 'Algunos presupuestos no son válidos' }, { status: 400 });
      }

      // Calcular monto total
      totalAmount = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    } else if (saleMode === 'direct' && directSale) {
      totalAmount = directSale.amount;
    }

    // Start transaction
    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
      // 1. Registrar la venta sobre los presupuestos aprobados
      if (saleMode === 'quotes' && quoteIds && quotes.length > 0) {
        await QuoteModel.updateMany(
          { _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) } },
          {
            $set: {
              status: 'approved',
              approvedAt: new Date(),
              updatedBy: new Types.ObjectId(userId),
            },
          },
          { session }
        );
        quotesApproved = quoteIds.length;
      }

      // 2. Crear o obtener cliente del lead
      let clientId = lead.convertedToClient;

      if (!clientId) {
        // Crear nuevo cliente desde el lead
        let clientNotes = '';
        if (saleMode === 'quotes' && quotes.length > 0) {
          clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta confirmada por $${totalAmount.toLocaleString()}\n${quotes.length} presupuesto(s) aprobado(s)`;
        } else if (saleMode === 'direct' && directSale) {
          clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta directa confirmada por $${totalAmount.toLocaleString()}`;
          if (directSale.description) {
            clientNotes += `\nDescripción: ${directSale.description}`;
          }
        }
        if (notes) {
          clientNotes += `\nNotas: ${notes}`;
        }

        const [client] = await ClientModel.create(
          [
            {
              tenantId: new Types.ObjectId(tenantId),
              customerType: resolvedCustomerType,
              fullName: lead.name,
              companyName: lead.companyName,
              email: lead.email,
              phone: lead.phone,
              status: 'active',
              source: lead.source,
              notes: clientNotes,
              createdBy: new Types.ObjectId(userId),
              updatedBy: new Types.ObjectId(userId),
            },
          ],
          { session }
        );
        clientId = client._id;

        // Actualizar lead con referencia al cliente
        await LeadModel.updateOne(
          { _id: lead._id },
          {
            $set: {
              convertedToClient: clientId,
              convertedAt: new Date(),
              updatedBy: userId,
            },
          },
          { session }
        );
      }

      // 3. Actualizar estado del lead a ganado
      await LeadModel.updateOne(
        { _id: lead._id },
        {
          $set: {
            status: 'won',
            updatedBy: userId,
          },
        },
        { session }
      );

      // 4. Create work order for the won lead
      const workOrderNumber = await getNextWorkOrderNumber(tenantId);
      
      // Get first quote for location/quoteId reference
      let firstQuoteId = null;
      let locationId = null;
      let locationSnapshot = {};
      
      if (saleMode === 'quotes' && quotes.length > 0) {
        const firstQuote = quotes[0];
        firstQuoteId = firstQuote._id;
        
        // Try to get location from quote if available
        if (firstQuote.locationId) {
          locationId = firstQuote.locationId;
          // Get location snapshot if available
          const LocationModel = (await import('@/locations/models/location')).default;
          const location = await LocationModel.findById(locationId).lean();
          if (location) {
            locationSnapshot = {
              name: location.name,
              address: location.address,
            };
          }
        }
      }
      
      const workOrderData = {
        tenantId: new Types.ObjectId(tenantId),
        clientId,
        leadId: lead._id,
        quoteId: firstQuoteId,
        locationId: locationId || null,
        clientSnapshot: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName || '',
          customerType: resolvedCustomerType,
          status: 'active',
        },
        locationSnapshot: Object.keys(locationSnapshot).length > 0 
          ? locationSnapshot 
          : (saleMode === 'quotes' ? {} : {
              name: lead.companyName || lead.name,
              address: '',
            }),
        source: 'manual', // TODO: change to 'lead_conversion' or 'direct_sale' after server restart
        workOrderNumber,
        title: `Venta: ${lead.companyName || lead.name}`,
        description: notes || `Venta generada desde lead #${lead._id}`,
        priority: 'normal',
        category: 'installation',
        status: 'draft',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      };
      
      const [workOrder] = await WorkOrderModel.create([workOrderData], { session });

      // Link quotes to the work order so hasWorkOrder resolves correctly
      if (saleMode === 'quotes' && quoteIds) {
        await QuoteModel.updateMany(
          { _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) } },
          { $set: { convertedToWorkOrder: workOrder._id } },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      // Reasignar presupuestos si corresponde
      if (saleMode === 'quotes' && quoteIds && clientId) {
        await CommercialProcessService.onConfirmSale(
          leadId, 
          quoteIds, 
          clientId.toString(), 
          tenantId, 
          userId,
          totalAmount,
          'quotes'
        );
      } else if (saleMode === 'direct' && clientId && directSale) {
        // Para venta directa, también crear la actividad
        await CommercialProcessService.onConfirmSale(
          leadId,
          [],
          clientId.toString(),
          tenantId,
          userId,
          totalAmount,
          'direct'
        );
      }

      return NextResponse.json({
        success: true,
        clientId: clientId.toString(),
        totalAmount,
        quotesApproved,
        saleMode,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error confirming sale:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
