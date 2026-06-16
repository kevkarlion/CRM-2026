import mongoose, { Model } from 'mongoose';
import { IVisitReport } from '../types/visit-report';
import { visitReportSchema } from '../schemas/visit-report';

const VisitReportModel: Model<IVisitReport> =
  mongoose.model<IVisitReport>('VisitReport', visitReportSchema);

export default VisitReportModel;
