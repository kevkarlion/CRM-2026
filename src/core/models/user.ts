import mongoose, { Model } from 'mongoose';
import { IUser } from '../types/user';
import { userSchema } from '../schemas/user';

const UserModel: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default UserModel;
