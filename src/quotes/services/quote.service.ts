import mongoose, { Types } from 'mongoose';
import QuoteModel from '../models/quote';
import QuoteVersionModel from '../models/quote-version';
import LeadModel from '@/leads/models/lead';
import { validateTransition, validateSendRequirements, validateApproveRequirements } from '../helpers/state-machine';
import { getNextQuoteNumber } from '../helpers/counter';
import { processItems, calculateSubtotal, calculateTotal } from '../helpers/calculator';
import { logActivity } from '../../audit/activity-logger';
import { cursorPage } from '../../crm/helpers/cursor-pagination';
import TenantModel from '../../core/models/tenant';
import type { IQuote, QuoteStatus, CreateQuoteInput, UpdateQuoteInput } from '../types/quote';
import type { IQuoteVersion } from '../types/quote-version';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

const TERMINAL_STATES: QuoteStatus[] = ['approved', 'rejected', 'expired', 'cancelled'];

export interface QuoteListFilters {
  status?: QuoteStatus;
  clientId?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface QuoteListResult {
  data: IQuote[];
  cursor?: string;
  total: number;
}

export interface CreateQuoteResult {
  quote: IQuote;
  version: IQuoteVersion;
}

export interface GetQuoteResult {
  quote: IQuote;
  currentVersion: IQuoteVersion | null;
}

export interface UpdateQuoteResult {
  quote: IQuote;
  version?: IQuoteVersion;
  newVersion: boolean;
}

export class QuoteService {
  async createQuote(
    data: CreateQuoteInput,
    userId: string,
    tenantId: string,
  ): Promise<CreateQuoteResult> {
    if (!data.items?.length) {
      throw new ValidationError('La cotización debe tener al menos un ítem');
    }

    const prefix = await this.getTenantQuotePrefix(tenantId);
    const number = await getNextQuoteNumber(tenantId, prefix);

    const processedItems = processItems(data.items);
    const subtotal = calculateSubtotal(processedItems);
    const discountAmount = data.discountAmount ?? 0;
    const taxAmount = data.taxAmount ?? 0;
    const total = calculateTotal(subtotal, discountAmount, taxAmount);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [quote] = await QuoteModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        leadId: data.leadId ? new Types.ObjectId(data.leadId) : null,
        clientId: data.clientId ? new Types.ObjectId(data.clientId) : null,
        locationId: data.locationId ? new Types.ObjectId(data.locationId) : null,
        number,
        status: 'draft',
        currentVersion: 1,
        title: data.title,
        description: data.description,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        notes: data.notes,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });

      const [version] = await QuoteVersionModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        quoteId: quote._id,
        version: 1,
        title: data.title,
        description: data.description,
        items: processedItems,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        notes: data.notes,
        createdBy: new Types.ObjectId(userId),
      }], { session });

      // Note: Lead status is NOT updated here. 
      // It will be updated when the quote is sent.

      await session.commitTransaction();

      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: String(quote._id),
        action: 'created',
        actorId: userId,
        metadata: { number, version: 1 },
      });

      return {
        quote: quote.toObject() as unknown as IQuote,
        version: version.toObject() as unknown as IQuoteVersion,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getQuote(quoteId: string, tenantId: string): Promise<GetQuoteResult> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .populate('clientId', 'fullName companyName email phone')
      
      .exec();

    if (!quote) {
      throw new NotFoundError('Cotización no encontrada');
    }

    const currentVersion = await QuoteVersionModel.findOne({
      quoteId: new Types.ObjectId(quoteId),
      version: quote.currentVersion,
    })
      
      .exec();

    return {
      quote: quote as unknown as IQuote,
      currentVersion: currentVersion as unknown as IQuoteVersion | null,
    };
  }

  async listQuotes(
    filters: QuoteListFilters,
    tenantId: string,
  ): Promise<QuoteListResult> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.clientId) {
      filter.clientId = new Types.ObjectId(filters.clientId);
    }

    if (filters.createdAtGte || filters.createdAtLte) {
      const createdAtFilter: Record<string, unknown> = {};
      if (filters.createdAtGte) {
        createdAtFilter.$gte = new Date(filters.createdAtGte);
      }
      if (filters.createdAtLte) {
        createdAtFilter.$lte = new Date(filters.createdAtLte);
      }
      filter.createdAt = createdAtFilter;
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { number: { $regex: escaped, $options: 'i' } },
      ];
    }

    const total = await QuoteModel.countDocuments(filter).exec();

    const page = await cursorPage(QuoteModel, filter, {
      limit: filters.limit || 20,
      cursor: filters.cursor,
      sort: { createdAt: -1 },
    } as never);

    return {
      data: page.data as unknown as IQuote[],
      cursor: page.cursor ?? undefined,
      total,
    };
  }

  async updateQuote(
    quoteId: string,
    data: UpdateQuoteInput,
    userId: string,
    tenantId: string,
  ): Promise<UpdateQuoteResult> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      throw new NotFoundError('Cotización no encontrada');
    }

    if (TERMINAL_STATES.includes(quote.status as QuoteStatus)) {
      throw new ValidationError(
        `No se puede modificar una cotización en estado '${quote.status}'`,
      );
    }

    const currentVersionDoc = await QuoteVersionModel.findOne({
      quoteId: new Types.ObjectId(quoteId),
      version: quote.currentVersion,
    })
      
      .exec();

    const hasVersionedChanges =
      data.items !== undefined ||
      data.discountAmount !== undefined ||
      data.taxAmount !== undefined ||
      data.title !== undefined ||
      data.description !== undefined ||
      data.notes !== undefined ||
      data.validUntil !== undefined;

    if (hasVersionedChanges) {
      const existingItems = currentVersionDoc?.items || [];
      const processedItems = data.items
        ? processItems(data.items)
        : existingItems;
      const subtotal = calculateSubtotal(processedItems);
      const discountAmount = data.discountAmount ?? quote.discountAmount;
      const taxAmount = data.taxAmount ?? quote.taxAmount;
      const total = calculateTotal(subtotal, discountAmount, taxAmount);

      const nextVersion = (quote.currentVersion || 0) + 1;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const [version] = await QuoteVersionModel.create([{
          tenantId: new Types.ObjectId(tenantId),
          quoteId: new Types.ObjectId(quoteId),
          version: nextVersion,
          title: data.title ?? quote.title,
          description: data.description ?? quote.description,
          items: processedItems as unknown as IQuoteVersion['items'],
          subtotal,
          discountAmount,
          taxAmount,
          total,
          notes: data.notes ?? quote.notes,
          createdBy: new Types.ObjectId(userId),
        }], { session });

        const updatedQuote = await QuoteModel.findOneAndUpdate(
          {
            _id: new Types.ObjectId(quoteId),
            tenantId: new Types.ObjectId(tenantId),
            deletedAt: null,
          },
          {
            $set: {
              title: data.title ?? quote.title,
              description: data.description ?? quote.description,
              validUntil: data.validUntil ? new Date(data.validUntil) : quote.validUntil,
              notes: data.notes ?? quote.notes,
              locationId: data.locationId ? new Types.ObjectId(data.locationId) : quote.locationId,
              subtotal,
              discountAmount,
              taxAmount,
              total,
              currentVersion: nextVersion,
              updatedBy: new Types.ObjectId(userId),
            },
          },
          { new: true, session },
        )
          
          .exec();

        if (!updatedQuote) {
          throw new ConflictError('Error al actualizar la cotización');
        }

        await session.commitTransaction();

        await logActivity({
          tenantId,
          entityType: 'quote',
          entityId: quoteId,
          action: 'version_created',
          actorId: userId,
          metadata: { newVersion: nextVersion, versioned: true },
          changes: {
            before: { currentVersion: quote.currentVersion },
            after: { currentVersion: nextVersion },
          },
        });

        return {
          quote: updatedQuote as unknown as IQuote,
          version: version.toObject() as unknown as IQuoteVersion,
          newVersion: true,
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    const updatedQuote = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $set: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.validUntil !== undefined && { validUntil: new Date(data.validUntil) }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.locationId !== undefined && { locationId: new Types.ObjectId(data.locationId) }),
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updatedQuote) {
      throw new ConflictError('Error al actualizar la cotización');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'updated',
      actorId: userId,
      metadata: { commercial: false },
    });

    return {
      quote: updatedQuote as unknown as IQuote,
      newVersion: false,
    };
  }

  async sendQuote(
    quoteId: string,
    userId: string,
    tenantId: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      throw new NotFoundError('Cotización no encontrada');
    }

    const currentStatus = quote.status as QuoteStatus;
    validateTransition(currentStatus, 'sent');

    const currentVersion = await QuoteVersionModel.findOne({
      quoteId: new Types.ObjectId(quoteId),
      version: quote.currentVersion,
    })
      
      .exec();

    const versionItems = currentVersion?.items || [];
    validateSendRequirements({
      items: versionItems as unknown[],
      clientId: quote.clientId,
      leadId: quote.leadId,
      validUntil: quote.validUntil,
    });

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        status: currentStatus,
        deletedAt: null,
      },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('La cotización ya fue modificada por otro usuario');
    }

    // If quote is associated with a lead, update lead status
    // First check if there are other sent quotes for this lead
    if (quote.leadId) {
      const sentQuotesCount = await QuoteModel.countDocuments({
        leadId: quote.leadId,
        tenantId: new Types.ObjectId(tenantId),
        status: 'sent',
        deletedAt: null,
        _id: { $ne: quote._id }, // exclude current quote
      });

      // Only update lead if this is the first sent quote
      if (sentQuotesCount === 0) {
        await LeadModel.updateOne(
          { _id: quote.leadId, tenantId: new Types.ObjectId(tenantId) },
          { 
            $set: { 
              status: 'quote_sent',
              qualificationStatus: 'qualified',
              updatedBy: new Types.ObjectId(userId),
            } 
          }
        );
      }
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'status_changed',
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: 'sent' },
      },
    });

    return updated as unknown as IQuote;
  }

  async approveQuote(
    quoteId: string,
    userId: string,
    tenantId: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'sent',
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      const existing = await QuoteModel.findOne({
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
        
        .exec();

      if (!existing) {
        throw new NotFoundError('Cotización no encontrada');
      }
      throw new ValidationError(
        `La cotización debe estar en estado 'sent' para aprobarse. Estado actual: '${existing.status}'`,
      );
    }

    const currentStatus = quote.status as QuoteStatus;
    validateTransition(currentStatus, 'approved');
    validateApproveRequirements(quote as { validUntil: Date | null });

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        status: 'sent',
        deletedAt: null,
      },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('La cotización ya fue modificada por otro usuario');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'status_changed',
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: 'approved' },
      },
    });

    return updated as unknown as IQuote;
  }

  async rejectQuote(
    quoteId: string,
    userId: string,
    tenantId: string,
    reason?: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'sent',
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      const existing = await QuoteModel.findOne({
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
        
        .exec();

      if (!existing) {
        throw new NotFoundError('Cotización no encontrada');
      }
      throw new ValidationError(
        `La cotización debe estar en estado 'sent' para rechazarse. Estado actual: '${existing.status}'`,
      );
    }

    const currentStatus = quote.status as QuoteStatus;
    validateTransition(currentStatus, 'rejected');

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        status: 'sent',
        deletedAt: null,
      },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedReason: reason || null,
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('La cotización ya fue modificada por otro usuario');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'status_changed',
      actorId: userId,
      metadata: { reason },
      changes: {
        before: { status: currentStatus },
        after: { status: 'rejected' },
      },
    });

    return updated as unknown as IQuote;
  }

  async cancelQuote(
    quoteId: string,
    userId: string,
    tenantId: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      throw new NotFoundError('Cotización no encontrada');
    }

    const currentStatus = quote.status as QuoteStatus;

    if (currentStatus !== 'draft' && currentStatus !== 'sent') {
      throw new ValidationError(
        `Solo se pueden cancelar cotizaciones en estado 'draft' o 'sent'. Estado actual: '${currentStatus}'`,
      );
    }

    validateTransition(currentStatus, 'cancelled');

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        status: currentStatus,
        deletedAt: null,
      },
      {
        $set: {
          status: 'cancelled',
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('La cotización ya fue modificada por otro usuario');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'status_changed',
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: 'cancelled' },
      },
    });

    return updated as unknown as IQuote;
  }

  async expireQuote(
    quoteId: string,
    userId: string,
    tenantId: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'sent',
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      const existing = await QuoteModel.findOne({
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
        
        .exec();

      if (!existing) {
        throw new NotFoundError('Cotización no encontrada');
      }
      throw new ValidationError(
        `La cotización debe estar en estado 'sent' para expirar. Estado actual: '${existing.status}'`,
      );
    }

    const currentStatus = quote.status as QuoteStatus;
    validateTransition(currentStatus, 'expired');

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        status: 'sent',
        deletedAt: null,
      },
      {
        $set: {
          status: 'expired',
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('La cotización ya fue modificada por otro usuario');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'status_changed',
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: 'expired' },
      },
    });

    return updated as unknown as IQuote;
  }

  async softDelete(
    quoteId: string,
    userId: string,
    tenantId: string,
  ): Promise<IQuote> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!quote) {
      throw new NotFoundError('Cotización no encontrada');
    }

    const status = quote.status as QuoteStatus;
    if (TERMINAL_STATES.includes(status)) {
      throw new ValidationError(
        `No se puede eliminar una cotización en estado terminal '${status}'`,
      );
    }

    const updated = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    )
      
      .exec();

    if (!updated) {
      throw new ConflictError('Error al eliminar la cotización');
    }

    await logActivity({
      tenantId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'deleted',
      actorId: userId,
    });

    return updated as unknown as IQuote;
  }

  async getVersions(
    quoteId: string,
    tenantId: string,
  ): Promise<IQuoteVersion[]> {
    const versions = await QuoteVersionModel.find({
      quoteId: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ version: -1 })
      
      .exec();

    return versions as unknown as IQuoteVersion[];
  }

  async expireBatch(tenantId: string): Promise<number> {
    const result = await QuoteModel.updateMany(
      {
        tenantId: new Types.ObjectId(tenantId),
        status: 'sent',
        validUntil: { $lte: new Date() },
        deletedAt: null,
      },
      {
        $set: {
          status: 'expired',
        },
      },
    ).exec();

    return result.modifiedCount;
  }

  private async getTenantQuotePrefix(tenantId: string): Promise<string> {
    try {
      const tenant = await TenantModel.findById(tenantId)
        .select('quoteNumberPrefix')
        
        .exec();
      return tenant?.quoteNumberPrefix || 'COT';
    } catch {
      return 'COT';
    }
  }
}
