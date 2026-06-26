'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { usePipelineLeads } from '../hooks/usePipelineLeads';
import { usePipelineBoard } from '../hooks/usePipelineBoard';
import { PipelineColumn } from './PipelineColumn';
import { LeadFilters } from './LeadFilters';
import { DragOverlayCard } from './DragOverlayCard';
import type { ILead } from '../../types/lead';

function SkeletonColumn() {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 min-w-[85vw] md:min-w-[280px] md:flex-1 snap-start animate-pulse">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="skeleton-text w-24 h-4" />
        <div className="skeleton-text w-6 h-4" />
      </div>
      <div className="p-2 space-y-2">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-text w-1/2 mb-3" />
          <div className="skeleton-text w-2/3 mb-2" />
          <div className="skeleton h-3 w-full mb-1" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="flex items-center justify-center h-full py-16">
      <div className="text-center">
        <p className="text-gray-500 text-sm">No hay leads que coincidan con los filtros</p>
      </div>
    </div>
  );
}

export function PipelineBoard() {
  const {
    pipeline,
    groups,
    unmatched,
    loading,
    error,
    refetch,
  } = usePipelineLeads();

  const stages = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.stages.filter((s) => s.isActive).sort((a, b) => a.position - b.position);
  }, [pipeline]);

  const {
    columns,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    setColumns,
  } = usePipelineBoard(stages, refetch);

  const [reFetching, setReFetching] = useState(false);

  const prevGroupsRef = useMemo(() => groups, [groups]);
  if (loading && !error) {
    const columns = groups && Object.keys(groups).length > 0;
  }

  const hasData = Object.keys(groups).length > 0;

  const activeLead: ILead | null = useMemo(() => {
    if (!activeId) return null;
    for (const column of Object.values(columns)) {
      const found = column.find((l) => String(l._id) === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  const visibleColumns = useMemo(() => {
    if (Object.keys(columns).length > 0) return columns;
    return groups;
  }, [columns, groups]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 500, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  if (error && !hasData) {
    return (
      <div className="h-full overflow-hidden">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const allEmpty = Object.values(visibleColumns).every(
    (col) => col.length === 0,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <LeadFilters stages={stages} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {loading && !hasData ? (
          <div className="flex gap-4 p-4 overflow-x-auto scroll-snap-x-mandatory flex-1">
            <SkeletonColumn />
            <SkeletonColumn />
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
        ) : allEmpty && !loading ? (
          <EmptyBoard />
        ) : (
          <div className="flex gap-4 p-4 overflow-x-auto scroll-snap-x-mandatory flex-1">
            {stages.map((stage) => {
              const stageLeads = visibleColumns[stage.name] || [];
              return (
                <PipelineColumn
                  key={stage.name}
                  stage={stage}
                  leads={stageLeads}
                  isLoading={false}
                  onLeadClick={(leadId) => {
                    console.log('Lead clicked:', leadId);
                  }}
                />
              );
            })}

            {unmatched.length > 0 && (
              <div className="bg-gray-100 rounded-lg border border-dashed border-gray-300 min-w-[85vw] md:min-w-[260px] snap-start">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-500 truncate">
                      Sin etapa
                    </h3>
                    <span className="badge badge-neutral text-xs shrink-0">
                      {unmatched.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Leads con estado sin etapa asignada
                  </p>
                </div>
                <div className="p-2 space-y-2">
                  {unmatched.map((lead) => (
                    <div
                      key={String(lead._id)}
                      className="bg-white rounded-lg border border-gray-200 p-3 opacity-60 cursor-default"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {lead.name}
                      </p>
                      {lead.companyName && (
                        <p className="text-xs text-gray-500 truncate">{lead.companyName}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DragOverlay>
          {activeLead ? <DragOverlayCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
