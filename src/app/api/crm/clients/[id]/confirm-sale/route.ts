import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import {
  ConflictError,
  NotFoundError,
  SaleConfirmationService,
  ValidationError,
} from '@/crm/services/sale-confirmation.service';

interface DirectSaleItem {
  description: string;
  type: 'product' | 'service' | 'labor' | 'material' | 'part';
  quantity: number;
  unitPrice: number;
}

interface ConfirmSaleInput {
  saleMode: 'quotes' | 'direct';
  quoteIds?: string[];
  notes?: string;
  directSale?: {
    amount: number;
    description?: string;
    serviceTypeId?: string;
    items?: DirectSaleItem[];
  };
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

    const body = await request.json() as ConfirmSaleInput;
    const { saleMode, quoteIds, notes, directSale } = body;

    // Validar según el modo
    if (saleMode === 'quotes' && (!quoteIds || quoteIds.length === 0)) {
      return NextResponse.json({ error: 'Selecciona al menos un presupuesto' }, { status: 400 });
    }

    if (saleMode === 'direct' && (!directSale || directSale.amount <= 0)) {
      return NextResponse.json({ error: 'Ingresa un monto válido para la venta directa' }, { status: 400 });
    }

    const result = await SaleConfirmationService.confirmSale({
      entityType: 'client',
      entityId: clientId,
      saleMode,
      quoteIds,
      notes,
      directSale,
      tenantId,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error confirming sale:', error);
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
