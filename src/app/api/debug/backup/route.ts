import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { Types } from 'mongoose';

/**
 * POST /api/debug/backup
 * Crea un backup de la base de datos y lo guarda en Cloudinary
 * 
 * Header: x-tenant-id (requerido para autenticación)
 * Header: x-user-id (requerido)
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  const userId = request.headers.get('x-user-id');

  if (!tenantId || !userId) {
    return NextResponse.json(
      { error: 'x-tenant-id and x-user-id headers are required' },
      { status: 401 }
    );
  }

  try {
    await connectDB();
    const db = process.db;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `crm_backup_${timestamp}.json`;
    
    // Collections críticas a respaldar
    const collections = [
      'leads', 'clients', 'workorders', 'quotes', 
      'conversations', 'whatsappmessages', 'documents',
      'gestions', 'quotes', 'negotiations'
    ];

    const backupData: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      createdBy: userId,
      tenantId,
      data: {}
    };

    for (const col of collections) {
      console.log(`[backup] Respaldando ${col}...`);
      const docs = await db.collection(col).find({ 
        tenantId: new Types.ObjectId(tenantId) 
      }).limit(10000).toArray();
      
      (backupData.data as Record<string, unknown>)[col] = docs;
      console.log(`[backup] ${col}: ${docs.length} documentos`);
    }

    // Convertir a string
    const jsonString = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');

    // Subir a Cloudinary
    const { default: cloudinaryService } = await import('@/core/services/cloudinary.service');
    
    const uploadResult = await cloudinaryService.uploadBuffer(
      buffer,
      backupFilename,
      {
        folder: `crm/${tenantId}/backups`,
        resourceType: 'raw' as const,
        publicId: `backup_${timestamp}`
      }
    );

    console.log('[backup] ✅ Backup creado:', uploadResult.secure_url);

    return NextResponse.json({
      success: true,
      backupUrl: uploadResult.secure_url,
      filename: backupFilename,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[backup] Error:', error);
    return NextResponse.json(
      { error: 'Error creando backup: ' + (error instanceof Error ? error.message : 'unknown') },
      { status: 500 }
    );
  }
}
