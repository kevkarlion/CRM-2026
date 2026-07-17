import mongoose, { Model } from 'mongoose';
import { INegotiationEvent } from '../types/negotiation-event';
import { negotiationEventSchema } from '../schemas/negotiation-event';

const NegotiationEventModel: Model<INegotiationEvent> =
  mongoose.models.NegotiationEvent || mongoose.model<INegotiationEvent>('NegotiationEvent', negotiationEventSchema);

export default NegotiationEventModel;
