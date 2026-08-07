import { ActivityService } from './activity.service';
import { EVENT_TYPES } from '@/crm/types/activity';
import { Types } from 'mongoose';

export class CommercialProcessService {
  static async onConfirmSale(
    entityType: 'lead' | 'client',
    entityId: string,
    quoteIds: string[],
    clientId: string,
    tenantId: string,
    userId: string,
    totalAmount: number,
    saleMode: 'quotes' | 'direct',
  ): Promise<void> {
    try {
      await new ActivityService().create(
        {
          tenantId: new Types.ObjectId(tenantId),
          leadId:
            entityType === 'lead'
              ? new Types.ObjectId(entityId)
              : undefined,
          entityType,
          entityId: new Types.ObjectId(entityId),
          activityType: 'status_change' as const,
          eventType:
            entityType === 'lead'
              ? EVENT_TYPES.LEAD_CONVERTED
              : EVENT_TYPES.CLIENT_SALE_CONFIRMED,
          title: saleMode === 'quotes' ? 'Venta confirmada' : 'Venta directa confirmada',
          description: `Venta por $${totalAmount.toLocaleString('es-CL')}. Cliente ID: ${clientId}`,
          performedBy: new Types.ObjectId(userId),
          metadata: {
            clientId,
            quoteIds,
            totalAmount,
            saleMode,
          },
        },
        tenantId,
      );
    } catch (error) {
      console.error('Error creating sale activity:', error);
    }
  }
}
