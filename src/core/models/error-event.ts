import mongoose, { Model } from 'mongoose';
import { IErrorEvent } from '../types/error-event';
import { errorEventSchema } from '../schemas/error-event';

const ErrorEventModel: Model<IErrorEvent> =
  mongoose.models.ErrorEvent || mongoose.model<IErrorEvent>(
  'ErrorEvent',
  errorEventSchema
);

export default ErrorEventModel;
