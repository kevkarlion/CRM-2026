import mongoose, { Model } from 'mongoose';
import { IConversation } from '../domain/conversation';
import { conversationSchema } from '../schemas/conversation';

const ConversationModel: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>('Conversation', conversationSchema);

export default ConversationModel;
