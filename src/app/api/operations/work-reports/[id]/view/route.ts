import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import mongoose from 'mongoose';

/**
 * PATCH /api/operations/work-reports/[id]/view
 *
 * Marca un informe como visto (global). Cuando CUALQUIER usuario abre el
 * informe, se setea `viewedAt` la primera vez; a partir de ahí el badge
 * "Nuevo" deja de mostrarse para todos los usuarios.
 *
 * Es idempotente: solo setea `viewedAt` si aún no está marcado.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;
    if (!/^[0-9a-f]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
    }

    await connectDB();
    const db = mongoose.connection.db!;

    const report = await db.collection('workreports').findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    // Solo marca la primera vista. Si ya fue visto, no sobreescribe la fecha.
    if (!report.viewedAt) {
      await db.collection('workreports').updateOne(
        { _id: report._id },
        { $set: { viewedAt: new Date() }, $inc: { version: 1 } },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WorkReport View PATCH] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}
