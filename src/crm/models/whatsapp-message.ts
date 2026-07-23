import mongoose, { Model } from 'mongoose';
import { IWhatsAppMessage } from '../types/whatsapp-message';
import { whatsappMessageSchema } from '../schemas/whatsapp-message';

const WhatsAppMessageModel: Model<IWhatsAppMessage> = 
  mongoose.models.WhatsAppMessage || 
  mongoose.model<IWhatsAppMessage>('WhatsAppMessage', whatsappMessageSchema);

export default WhatsAppMessageModel;