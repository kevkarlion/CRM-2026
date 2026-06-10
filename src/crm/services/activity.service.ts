import { ActivityModel } from '../models';
import { IActivity, CreateActivityInput } from '../types/activity';
import { cursorPage } from '../helpers/cursor-pagination';
import { CursorPage, CursorOptions } from '../types/common';

export class ActivityService {
  async create(data: CreateActivityInput, tenantId: string): Promise<IActivity> {
    const activity = await ActivityModel.create({
      ...data,
      tenantId,
    });
    return activity.toObject();
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    tenantId: string,
    options?: Partial<CursorOptions>
  ): Promise<CursorPage<IActivity>> {
    return cursorPage<IActivity>(
      ActivityModel,
      { entityType, entityId, tenantId },
      {
        limit: options?.limit || 20,
        cursor: options?.cursor,
        sortField: 'createdAt',
        sortOrder: -1,
      }
    );
  }
}
