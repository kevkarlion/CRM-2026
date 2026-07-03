import mongoose, { Model } from 'mongoose';
import { IServiceType } from '../types/service-type';
import { serviceTypeSchema } from '../schemas/service-type';

const ServiceTypeModel: Model<IServiceType> = 
  mongoose.models.ServiceType || mongoose.model<IServiceType>('ServiceType', serviceTypeSchema);

export default ServiceTypeModel;
