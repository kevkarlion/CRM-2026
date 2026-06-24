import mongoose, { Model } from 'mongoose';
import { IQuote } from '../types/quote';
import { quoteSchema } from '../schemas/quote';

const QuoteModel: Model<IQuote> = mongoose.model<IQuote>('Quote', quoteSchema);

export default QuoteModel;
