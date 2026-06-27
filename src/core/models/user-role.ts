import mongoose, { Model } from 'mongoose';
import { IUserRole } from '../types/user-role';
import { userRoleSchema } from '../schemas/user-role';

const UserRoleModel: Model<IUserRole> = mongoose.models.UserRole || mongoose.model<IUserRole>('UserRole', userRoleSchema);

export default UserRoleModel;
