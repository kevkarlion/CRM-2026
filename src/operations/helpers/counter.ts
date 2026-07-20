import { Schema, model, Model, models } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const CounterModel: Model<ICounter> = models.WorkOrderCounter || model<ICounter>('WorkOrderCounter', counterSchema);

export async function getNextWorkOrderNumber(tenantPrefix: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `WO-${tenantPrefix}-${dateStr}`;

  const result = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = result.seq.toString().padStart(4, '0');
  return `${counterId}-${seq}`;
}
