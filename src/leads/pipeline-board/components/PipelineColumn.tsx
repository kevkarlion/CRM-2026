import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ILead } from '../../types/lead';
import type { IPipelineStage } from '../../types/pipeline';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { ColumnHeader } from './ColumnHeader';
import { LeadCard } from './LeadCard';
import type { FollowUpMark } from '@/crm/types/follow-up-mark';

interface PipelineColumnProps {
  stage: IPipelineStage;
  leads: ILead[];
  isLoading?: boolean;
  onLeadClick?: (leadId: string) => void;
  onWhatsAppClick?: (lead: ILead) => void;
  conversationStatusMap?: Map<string, ConversationStatus>;
  getConversationStatus?: (lead: ILead) => ConversationStatus | undefined;
  onTakeCase?: (lead: ILead) => void;
  onQuickReply?: (lead: ILead) => void;
  onOpenChat?: (lead: ILead) => void;
  onResolve?: (lead: ILead) => void;
  followUpMarks?: FollowUpMark[];
  onMarkForFollowUp?: (lead: ILead) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 w-[280px] shrink-0 animate-pulse">
      <div className="skeleton-text w-3/4 mb-2" />
      <div className="skeleton-text w-1/2 mb-3" />
      <div className="skeleton-text w-2/3 mb-2" />
      <div className="skeleton h-3 w-full mb-1" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export const PipelineColumn = memo(function PipelineColumn({
  stage,
  leads,
  isLoading,
  onLeadClick,
  onWhatsAppClick,
  conversationStatusMap,
  getConversationStatus,
  onTakeCase,
  onQuickReply,
  onOpenChat,
  onResolve,
  followUpMarks,
  onMarkForFollowUp,
}: PipelineColumnProps) {
  return (
    <div
      className="bg-gray-50 rounded-lg border border-gray-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start"
    >
      <ColumnHeader stage={stage} leadCount={leads.length} />

      <div className="p-2 space-y-2 min-h-[120px]">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : leads.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No hay leads en esta etapa
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {leads.map((lead) => {
              const isGestion = (lead as any).source === 'gestion' || (lead as any).isFromGestion === true;
              const conversationStatus = getConversationStatus 
                ? getConversationStatus(lead)
                : conversationStatusMap?.get(String(lead._id));
              const followUpMark = followUpMarks?.find(m => m.targetId === String(lead._id));
              
              return (
                <motion.div
                  key={String(lead._id)}
                  layout
                  layoutId={String(lead._id)}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                  <LeadCard
                    lead={lead}
                    entityType={isGestion ? 'gestion' : 'lead'}
                    onClick={onLeadClick}
                    onWhatsAppClick={onWhatsAppClick}
                    conversationStatus={conversationStatus}
                    onTakeCase={onTakeCase}
                    onQuickReply={onQuickReply}
                    onOpenChat={onOpenChat}
                    onResolve={onResolve}
                    followUpMark={followUpMark}
                    onMarkForFollowUp={onMarkForFollowUp}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
});
