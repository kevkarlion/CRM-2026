import mongoose, { Model } from 'mongoose';
import '@/core/models/user'; // Register User model for ref resolution
import '@/core/models/tenant'; // Register Tenant model for ref resolution
import '@/leads/models/lead'; // Register Lead model for ref resolution
import { ITimelineEvent } from '../types/timeline-event';
import { timelineEventSchema } from '../schemas/timeline-event';

const TimelineEventModel: Model<ITimelineEvent> =
  mongoose.models.TimelineEvent ||
  mongoose.model<ITimelineEvent>('TimelineEvent', timelineEventSchema);

export default TimelineEventModel;
