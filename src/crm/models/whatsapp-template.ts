import mongoose, { Model } from 'mongoose';
import { IWhatsAppTemplate } from '../types/whatsapp-template';
import { whatsappTemplateSchema } from '../schemas/whatsapp-template';

const WhatsAppTemplateModel: Model<IWhatsAppTemplate> =
  mongoose.models.WhatsAppTemplate ||
  mongoose.model<IWhatsAppTemplate>('WhatsAppTemplate', whatsappTemplateSchema);

export default WhatsAppTemplateModel;
