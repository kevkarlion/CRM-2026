import { ContactModel } from '../models';
import { IContact, CreateContactInput, UpdateContactInput } from '../types/contact';

export class ContactService {
  async create(
    data: CreateContactInput,
    tenantId: string,
    userId: string
  ): Promise<IContact> {
    const contact = await ContactModel.create({
      ...data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return contact.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IContact | null> {
    return ContactModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async findByClient(
    clientId: string,
    tenantId: string
  ): Promise<IContact[]> {
    return ContactModel.find({ clientId, tenantId, deletedAt: null })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateContactInput,
    tenantId: string,
    userId: string
  ): Promise<IContact | null> {
    return ContactModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async setPrimary(
    contactId: string,
    clientId: string,
    tenantId: string,
    userId: string
  ): Promise<IContact | null> {
    // Unset existing primary for this client
    await ContactModel.updateMany(
      { clientId, tenantId, isPrimary: true, deletedAt: null },
      { $set: { isPrimary: false, updatedBy: userId } }
    );

    // Set new primary
    return ContactModel.findOneAndUpdate(
      { _id: contactId, clientId, tenantId, deletedAt: null },
      { $set: { isPrimary: true, updatedBy: userId } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await ContactModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
  }
}
