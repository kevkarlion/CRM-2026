import mongoose, { Model } from 'mongoose';
import { IPermission } from '../types/permission';
import { permissionSchema } from '../schemas/permission';

const PermissionModel: Model<IPermission> = mongoose.model<IPermission>('Permission', permissionSchema);

export default PermissionModel;
