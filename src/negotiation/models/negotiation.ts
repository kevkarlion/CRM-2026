import mongoose, { Model } from 'mongoose';
import { INegotiation } from '../types/negotiation';
import { negotiationSchema } from '../schemas/negotiation';

const NegotiationModel: Model<INegotiation> =
  mongoose.models.Negotiation || mongoose.model<INegotiation>('Negotiation', negotiationSchema);

export default NegotiationModel;
