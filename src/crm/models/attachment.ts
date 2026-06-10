import mongoose, { Model } from 'mongoose';
import { IAttachment } from '../types/attachment';
import { attachmentSchema } from '../schemas/attachment';

const AttachmentModel: Model<IAttachment> = mongoose.model<IAttachment>('Attachment', attachmentSchema);

export default AttachmentModel;
