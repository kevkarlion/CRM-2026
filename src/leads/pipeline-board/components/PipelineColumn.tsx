import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { ILead } from '../../types/lead';
import type { IPipelineStage } from '../../types/pipeline';
import { ColumnHeader } from './ColumnHeader';
import { LeadCard } from './LeadCard';

interface PipelineColumnProps {
  stage: IPipelineStage;
  leads: ILead[];
  isLoading?: boolean;
  onLeadClick?: (leadId: string) => void;
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

export function PipelineColumn({ stage, leads, isLoading, onLeadClick }: PipelineColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.name,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-50 rounded-lg border min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start ${
        isOver ? 'ring-2 ring-brand-400' : 'border-gray-200'
      }`}
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
          leads.map((lead) => (
            <LeadCard key={String(lead._id)} lead={lead} onClick={onLeadClick} />
          ))
        )}
      </div>
    </div>
  );
}
