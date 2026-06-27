import mongoose, { Model } from 'mongoose';
import { ITenant } from '../types/tenant';
import { tenantSchema } from '../schemas/tenant';

const TenantModel: Model<ITenant> = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', tenantSchema);

export default TenantModel;
