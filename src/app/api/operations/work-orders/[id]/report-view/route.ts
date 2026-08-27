import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    
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
    
    return NextResponse.json({
      data: {
        ...report,
        technicianName,
        duration,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
