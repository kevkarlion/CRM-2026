import mongoose, { Model } from 'mongoose';
import { IPipeline } from '../types/pipeline';
import { pipelineSchema } from '../schemas/pipeline';

const PipelineModel: Model<IPipeline> = mongoose.model<IPipeline>('Pipeline', pipelineSchema);

export default PipelineModel;
