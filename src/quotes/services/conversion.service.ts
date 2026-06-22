import mongoose, { Types } from 'mongoose';
import QuoteModel from '../models/quote';
import QuoteVersionModel from '../models/quote-version';
import { getNextWorkOrderNumber } from '../../operations/helpers/counter';
import { WorkOrderModel } from '../../operations/models';
import { logActivity } from '../../audit/activity-logger';
import type { IQuote } from '../types/quote';
import type { IQuoteVersion } from '../types/quote-version';

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

export interface ConvertToWorkOrderOptions {
  priority?: string;
  category?: string;
}

export interface ConvertToWorkOrderResult {
  quote: IQuote;
  workOrder: Record<string, unknown>;
}

export class ConversionService {
  async convertToWorkOrder(
    quoteId: string,
    userId: string,
    tenantId: string,
    options?: ConvertToWorkOrderOptions,
  ): Promise<ConvertToWorkOrderResult> {
    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(quoteId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'approved',
      deletedAt: null,
    }).exec();

    if (!quote) {
      const existing = await QuoteModel.findOne({
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
        .lean()
        .exec();

      if (!existing) {
        throw new ConversionError('Cotización no encontrada');
      }
      if (existing.status !== 'approved') {
        throw new ConversionError(
          `La cotización debe estar aprobada para convertirla. Estado actual: '${existing.status}'`,
        );
      }
      if (existing.convertedToWorkOrder) {
        throw new ConversionError('La cotización ya fue convertida a una orden de trabajo');
      }
      throw new ConversionError('No se puede convertir la cotización');
    }

    if (quote.convertedToWorkOrder) {
      throw new ConversionError('La cotización ya fue convertida a una orden de trabajo');
    }

    const currentVersion = await QuoteVersionModel.findOne({
      quoteId: quote._id,
      version: quote.currentVersion,
    })
      .lean()
      .exec() as IQuoteVersion | null;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const ClientModel = (await import('../../crm/models/client')).default;
      const LocationModel = (await import('../../crm/models/location')).default;

      const client = await ClientModel.findById(quote.clientId).lean().exec();
      const location = quote.locationId
        ? await LocationModel.findById(quote.locationId).lean().exec()
        : null;

      const tenantPrefix = tenantId.toString().slice(-6);
      const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);

      const workOrderTitle = `${quote.number} v${quote.currentVersion}: ${currentVersion?.title || quote.title}`;

      const [workOrder] = await WorkOrderModel.create([{
        tenantId: quote.tenantId,
        clientId: quote.clientId,
        locationId: quote.locationId,
        clientSnapshot: {
          name: client?.fullName || client?.companyName,
          email: client?.email,
          phone: client?.phone,
          taxId: client?.taxId,
          customerType: client?.customerType,
          status: client?.status,
        },
        locationSnapshot: location ? {
          name: location.name,
          address: location.address,
          city: location.city,
          province: location.province,
          country: location.country,
          postalCode: location.postalCode,
        } : {},
        workOrderNumber,
        title: workOrderTitle,
        description: currentVersion?.description,
        priority: options?.priority || 'normal',
        category: options?.category || 'installation',
        status: 'draft',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });

      quote.convertedToWorkOrder = workOrder._id;
      quote.convertedAt = new Date();
      quote.updatedBy = new Types.ObjectId(userId);
      await quote.save({ session });

      await session.commitTransaction();

      await logActivity({
        tenantId,
        entityType: 'quote',
        entityId: quoteId,
        action: 'updated',
        actorId: userId,
        metadata: {
          convertedToWorkOrder: String(workOrder._id),
          workOrderNumber,
        },
      });

      return {
        quote: quote.toObject() as unknown as IQuote,
        workOrder: workOrder.toObject() as unknown as Record<string, unknown>,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
