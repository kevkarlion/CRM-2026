import { Schema, model, Model, models } from 'mongoose';

interface IQuoteCounter {
  _id: string;
  seq: number;
}

const quoteCounterSchema = new Schema<IQuoteCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const QuoteCounterModel: Model<IQuoteCounter> = models.QuoteCounter || model<IQuoteCounter>(
  'QuoteCounter',
  quoteCounterSchema
);

function getCounterId(prefix: string, tenantId: string): string {
  return `${prefix}-${tenantId}`;
}

export async function getNextQuoteNumber(
  tenantId: string,
  prefix: string = 'COT',
): Promise<string> {
  const counterId = getCounterId(prefix, tenantId);

  const result = await QuoteCounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = result.seq.toString().padStart(4, '0');
  return `${prefix}-${seq}`;
}
