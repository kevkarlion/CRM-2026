import mongoose, { Model } from 'mongoose';
import { ITask } from '../types/task';
import { taskSchema } from '../schemas/task';

const TaskModel: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', taskSchema);

export default TaskModel;
