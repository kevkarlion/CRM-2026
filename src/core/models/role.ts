import mongoose, { Model } from 'mongoose';
import { IRole } from '../types/role';
import { roleSchema } from '../schemas/role';

const RoleModel: Model<IRole> = mongoose.models.Role || mongoose.model<IRole>('Role', roleSchema);

export default RoleModel;
