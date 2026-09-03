import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const tenantId = req.headers.get('x-tenant-id');
    
    const clients = await ClientModel.find({
      tenantId: tenantId ? require('mongoose').Types.ObjectId.createFromHexString(tenantId) : null,
      deletedAt: null,
    })
    .select('fullName phone address locality province status createdAt')
    .limit(20)
    .lean();
    
    return NextResponse.json({ 
      count: clients.length,
      clients 
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Error') },
      { status: 500 }
    );
  }
}