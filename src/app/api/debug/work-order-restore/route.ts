import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    
    const body = await req.json();
    const { workOrderId, newStatus } = body;
    
    if (!workOrderId || !newStatus) {
      return NextResponse.json(
        { error: 'Se requiere workOrderId y newStatus' },
        { status: 400 }
      );
    }
    
    const validStatuses = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Status inválido. Debe ser uno de: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    const workOrder = await WorkOrderModel.findByIdAndUpdate(
      workOrderId,
      { 
        $set: { 
          status: newStatus,
          startedAt: newStatus === 'in_progress' ? new Date() : null,
          finishedAt: newStatus === 'completed' ? new Date() : null,
        }
      },
      { new: true }
    );
    
    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order no encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      workOrder: {
        _id: workOrder._id,
        title: workOrder.title,
        status: workOrder.status,
        startedAt: workOrder.startedAt,
        finishedAt: workOrder.finishedAt,
      }
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}