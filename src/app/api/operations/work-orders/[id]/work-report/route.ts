import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderModel } from '@/operations/models';
import { WorkReportService } from '@/operations/services/work-report.service';
import { TechnicianModel } from '@/operations/models/technician';
import mongoose from 'mongoose';

// Campos que el tecnico puede editar en su informe (NO incluye fechas/horarios).
const EDITABLE_FIELDS = [
  'result',
  'workPerformed',
  'workPerformedOther',
  'hasObservations',
  'observationsText',
  'hasAdditionalIssues',
  'additionalIssues',
  'additionalIssuesText',
  'nextVisitRecommendation',
  'internalComments',
  'materialsItems',
] as const;

// Ventana de edicion en horas: el tecnico puede editar dentro de las 12hs desde finishedAt.
const EDIT_WINDOW_HOURS = 12;

/**
 * GET /api/operations/work-orders/[id]/work-report
 * 
 * Retrieves the WorkReport associated with a WorkOrder.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: workOrderId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 400 }
      );
    }

    // Verify WorkOrder exists
    const workOrder = await WorkOrderModel.findOne({
      _id: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    // Get WorkReport by workOrderId
    const workReportService = new WorkReportService();
    const workReport = await workReportService.getByWorkOrderId(workOrderId, tenantId);

    if (!workReport) {
      return NextResponse.json(
        { error: 'WorkReport not found for this WorkOrder' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workReport,
    });
  } catch (error) {
    console.error('[WorkOrder WorkReport GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/operations/work-orders/[id]/work-report
 *
 * Edita el informe tecnico (WorkReport) de una WorkOrder.
 * Reglas:
 *  - Solo el tecnico autor de la OT (resuelto por x-user-id -> Technician.userId).
 *  - Solo dentro de una ventana de 12 horas desde finishedAt del informe.
 *  - No se pueden editar fechas ni horarios (startedAt, finishedAt, arrivalTime, departureTime).
 *  - Usa OCC por version.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: workOrderId } = await params;

    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const version = typeof body.version === 'number' ? body.version : undefined;

    if (version === undefined || version === null) {
      return NextResponse.json({ error: 'version es requerida (OCC)' }, { status: 400 });
    }

    // Verify WorkOrder exists
    const workOrder = await WorkOrderModel.findOne({
      _id: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!workOrder || !workOrder.workReportId) {
      return NextResponse.json({ error: 'WorkReport not found for this WorkOrder' }, { status: 404 });
    }

    const workReportService = new WorkReportService();
    const workReport = await workReportService.getById(String(workOrder.workReportId), tenantId);

    if (!workReport) {
      return NextResponse.json({ error: 'WorkReport not found' }, { status: 404 });
    }

    // Resolve the logged-in technician (same mapping as /my-orders)
    const technician = await TechnicianModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    // 1. Authorization: only the technician who owns the OT can edit
    if (!technician || String(workReport.technicianId) !== String(technician._id)) {
      return NextResponse.json(
        { error: 'Solo el técnico que realizó esta OT puede editar el informe' },
        { status: 403 }
      );
    }

    // 2. Window: only within 12h from finishedAt (fallback: createdAt)
    const baseTime = workReport.finishedAt
      ? new Date(workReport.finishedAt).getTime()
      : new Date(workReport.createdAt).getTime();
    const windowExpiresAt = baseTime + EDIT_WINDOW_HOURS * 60 * 60 * 1000;

    if (Date.now() > windowExpiresAt) {
      return NextResponse.json(
        { error: 'El plazo de edición del informe (12 horas) ya expiró' },
        { status: 403 }
      );
    }

    // 3. Whitelist: only editable fields; reject date/time (read-only)
    const payload: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        payload[field] = body[field];
      }
    }

    const forbidden = ['startedAt', 'finishedAt', 'arrivalTime', 'departureTime'].filter(
      (f) => f in body
    );
    if (forbidden.length > 0) {
      return NextResponse.json(
        { error: `No se pueden editar las fechas u horarios del informe: ${forbidden.join(', ')}` },
        { status: 422 }
      );
    }

    const updated = await workReportService.update(
      String(workReport._id),
      { ...payload, version },
      tenantId,
      userId,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[WorkOrder WorkReport PATCH] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}