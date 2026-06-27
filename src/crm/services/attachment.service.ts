import { AttachmentModel } from '../models';
import { IAttachment, CreateAttachmentInput } from '../types/attachment';

export class AttachmentService {
  async create(
    data: CreateAttachmentInput,
    tenantId: string
  ): Promise<IAttachment> {
    const attachment = await AttachmentModel.create({
      ...data,
      tenantId,
    });
    return attachment.toObject();
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<IAttachment[]> {
    return AttachmentModel.find({ entityType, entityId, tenantId })
      .sort({ createdAt: -1 })
      
      .exec() as unknown as Promise<IAttachment[]>;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await AttachmentModel.deleteOne({
      _id: id,
      tenantId,
    });
    return result.deletedCount > 0;
  }
}
