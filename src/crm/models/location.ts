import mongoose, { Model } from 'mongoose';
import { ILocation } from '../types/location';
import { locationSchema } from '../schemas/location';

const LocationModel: Model<ILocation> = mongoose.models.Location || mongoose.model<ILocation>('Location', locationSchema);

export default LocationModel;
