import { TaskModel } from '../models';
import { ITask, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { cursorPage } from '../helpers/cursor-pagination';
import { CursorPage, CursorOptions } from '../types/common';

export class TaskService {
  async create(
    data: CreateTaskInput,
    tenantId: string,
    userId: string
  ): Promise<ITask> {
    const task = await TaskModel.create({
      ...data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return task.toObject();
  }

  async findById(id: string, tenantId: string): Promise<ITask | null> {
    return TaskModel.findOne({ _id: id, tenantId, deletedAt: null })
      
      .exec() as unknown as Promise<ITask | null>;
  }

  async findByAssignedTo(
    assignedTo: string,
    tenantId: string,
    options?: Partial<CursorOptions>
  ): Promise<CursorPage<ITask>> {
    return cursorPage<ITask>(
      TaskModel,
      { assignedTo, tenantId, deletedAt: null },
      {
        limit: options?.limit || 20,
        cursor: options?.cursor,
        sortField: 'createdAt',
        sortOrder: -1,
      }
    );
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<ITask[]> {
    return TaskModel.find({ entityType, entityId, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      
      .exec() as unknown as Promise<ITask[]>;
  }

  async update(
    id: string,
    data: UpdateTaskInput,
    tenantId: string,
    userId: string
  ): Promise<ITask | null> {
    const setData: Record<string, unknown> = { ...data, updatedBy: userId };

    // Auto-set completedAt when status changes to completed
    if (data.status === 'completed') {
      setData.completedAt = new Date();
    }

    return TaskModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: setData },
      { new: true }
    )
      
      .exec() as unknown as Promise<ITask | null>;
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await TaskModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
  }
}
