import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import mongoose from 'mongoose';
import { TechnicianModel } from '@/operations/models/technician';

const EDIT_WINDOW_HOURS = 12;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    const db = mongoose.connection.db;
    
    // Find the workOrder to get workReportId
    let workOrderId = id;
    let isObjectId = /^[0-9a-f]{24}$/i.test(id);
    
    let workOrder;
    if (isObjectId) {
      workOrder = await db.collection('workorders').findOne({ _id: new mongoose.Types.ObjectId(id) });
    } else {
      workOrder = await db.collection('workorders').findOne({ workOrderNumber: id });
    }
    
    if (!workOrder) {
      // Try as ObjectId
      const byId = await db.collection('workorders').findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (byId) workOrder = byId;
    }
    
    if (!workOrder) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }
    
    if (!workOrder.workReportId) {
      return NextResponse.json({ error: 'No hay reporte para esta orden' }, { status: 404 });
    }
    
    // Fetch the work report
    const report = await db.collection('workreports').findOne({ _id: workOrder.workReportId });
    
    if (!report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }
    
    // Calculate duration if not saved
    let duration: number | undefined;
    if (report.startedAt && report.finishedAt) {
      duration = Math.round((new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()) / 60000);
    } else if (report.duration) {
      duration = report.duration;
    }
    
    // Get technician info
    let technicianName = 'Técnico';
    if (report.technicianId) {
      const tech = await db.collection('platformusers').findOne({ _id: report.technicianId });
      if (tech) technicianName = `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.email || 'Técnico';
    }

    // Compute edit eligibility: only the technician who owns the OT, within 12h window.
    let canEdit = false;
    let editExpiresAt: string | null = null;
    if (tenantId && userId) {
      try {
        const technician = await TechnicianModel.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          deletedAt: null,
        }).lean();

        const isAuthor = technician && report.technicianId
          ? String(report.technicianId) === String(technician._id)
          : false;

        const baseTime = report.finishedAt
          ? new Date(report.finishedAt).getTime()
          : new Date(report.createdAt).getTime();
        const expiresAt = baseTime + EDIT_WINDOW_HOURS * 60 * 60 * 1000;

        canEdit = isAuthor && Date.now() <= expiresAt;
        editExpiresAt = new Date(expiresAt).toISOString();
      } catch {
        // If technician lookup fails, default to not editable (deny).
        canEdit = false;
      }
    }
    
    return NextResponse.json({
      data: {
        ...report,
        technicianName,
        duration,
        canEdit,
        editExpiresAt,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}
