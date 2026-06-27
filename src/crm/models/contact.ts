import mongoose, { Model } from 'mongoose';
import { IContact } from '../types/contact';
import { contactSchema } from '../schemas/contact';

const ContactModel: Model<IContact> = mongoose.models.Contact || mongoose.model<IContact>('Contact', contactSchema);

export default ContactModel;
