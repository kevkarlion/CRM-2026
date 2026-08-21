import { connectDB } from '@/core/db';
import mongoose from 'mongoose';

export async function getNextRemitoNumber(tenantId: string): Promise<string> {
  await connectDB();

  const TenantModel = mongoose.models.Tenant || mongoose.model('Tenant', new mongoose.Schema());
  
  const tenant = await TenantModel.findById(tenantId).lean();
  const prefix = tenant?.name?.slice(0, 3).toUpperCase() || 'REM';
  
  const countResult = await mongoose.connection.db!.collection('remitos').countDocuments({
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
  
  const sequence = countResult + 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
