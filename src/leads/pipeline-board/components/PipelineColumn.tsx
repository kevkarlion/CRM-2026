import React, { memo } from 'react';
import type { ILead } from '../../types/lead';
import type { IPipelineStage } from '../../types/pipeline';
import type { ConversationStatus } from '../hooks/useConversationStatus';
import { ColumnHeader } from './ColumnHeader';
import { LeadCard } from './LeadCard';

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
          leads.map((lead) => {
            // Check if this is a Gestion by looking at the source field or custom property
            const isGestion = (lead as any).source === 'gestion' || (lead as any).isFromGestion === true;
            // Get conversation status - use getConversationStatus if available (supports originalLeadId)
            const conversationStatus = getConversationStatus 
              ? getConversationStatus(lead)
              : conversationStatusMap?.get(String(lead._id));
            return (
            <LeadCard
              key={String(lead._id)}
              lead={lead}
              entityType={isGestion ? 'gestion' : 'lead'}
              onClick={onLeadClick}
              onWhatsAppClick={onWhatsAppClick}
              conversationStatus={conversationStatus}
              onTakeCase={onTakeCase}
              onQuickReply={onQuickReply}
              onOpenChat={onOpenChat}
              onResolve={onResolve}
            />
            );
          })
        )}
      </div>
    </div>
  );
});
