import { ActivityService } from './activity.service';
import { EVENT_TYPES } from '@/activity/types/activity';
import { Types } from 'mongoose';

export class CommercialProcessService {
  static async onConfirmSale(
    leadId: string,
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
          entityType: 'lead',
          entityId: new Types.ObjectId(leadId),
          activityType: 'status_change' as const,
          title: saleMode === 'quotes' ? 'Venta confirmada' : 'Venta directa confirmada',
          description: `Venta por $${totalAmount.toLocaleString('es-CL')}. Cliente ID: ${clientId}`,
          performedBy: new Types.ObjectId(userId),
          metadata: {
            eventType: EVENT_TYPES.LEAD_WON,
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
