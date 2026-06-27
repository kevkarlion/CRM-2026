import mongoose, { Model } from 'mongoose';
import { IQuoteVersion } from '../types/quote-version';
import { quoteVersionSchema } from '../schemas/quote-version';

const QuoteVersionModel: Model<IQuoteVersion> =
  mongoose.models.QuoteVersion || mongoose.model<IQuoteVersion>(
  'QuoteVersion',
  quoteVersionSchema
);

export default QuoteVersionModel;
