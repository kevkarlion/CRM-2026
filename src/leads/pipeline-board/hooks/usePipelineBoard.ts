import { useState, useCallback } from 'react';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { ILead, LeadStatus } from '../../types/lead';
import type { IPipelineStage } from '../../types/pipeline';
import { canTransition } from '../../helpers/lead-state-machine';
import { isValidDropTarget } from '../utils/stage-mapper';

interface UsePipelineBoardReturn {
  columns: Record<string, ILead[]>;
  activeId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  setColumns: (columns: Record<string, ILead[]>) => void;
}

function findLeadById(leadId: string, columns: Record<string, ILead[]>): ILead | null {
  for (const column of Object.values(columns)) {
    const found = column.find((l) => String(l._id) === leadId);
    if (found) return found;
  }
  return null;
}

export function usePipelineBoard(
  pipelineStages: IPipelineStage[],
  onRefetch?: () => void,
): UsePipelineBoardReturn {
  const [columns, setColumns] = useState<Record<string, ILead[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        setActiveId(null);
        return;
      }

      const leadId = String(active.id);
      const targetStageName = String(over.id);

      const lead = findLeadById(leadId, columns);
      if (!lead) {
        setActiveId(null);
        return;
      }

      const targetStage = pipelineStages.find((s) => s.name === targetStageName);
      if (!targetStage || !targetStage.mapsToStatus) {
        setActiveId(null);
        return;
      }

      if (!isValidDropTarget(lead, targetStage)) {
        console.log('Movimiento no válido');
        setActiveId(null);
        return;
      }

      const previousColumns = structuredClone(columns);

      let sourceStageName: string | null = null;
      for (const [stageName, leads] of Object.entries(columns)) {
        if (leads.some((l) => String(l._id) === leadId)) {
          sourceStageName = stageName;
          break;
        }
      }

      if (!sourceStageName) {
        setActiveId(null);
        return;
      }

      const newColumns = { ...columns };
      newColumns[sourceStageName] = columns[sourceStageName].filter(
        (l) => String(l._id) !== leadId,
      );
      newColumns[targetStageName] = [
        ...columns[targetStageName],
        lead,
      ];
      setColumns(newColumns);

      try {
        const res = await fetch(`/api/crm/leads/${leadId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': 'default',
          },
          body: JSON.stringify({ status: targetStage.mapsToStatus }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }

        console.log(`Movido a ${targetStageName}`);
      } catch (err) {
        setColumns(previousColumns);
        const msg = err instanceof Error ? err.message : 'Error al mover el lead';
        console.error(msg);

        if (msg.includes('409') || msg.includes('Conflict')) {
          onRefetch?.();
        }
      } finally {
        setActiveId(null);
      }
    },
    [columns, pipelineStages, onRefetch],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return {
    columns,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    setColumns,
  };
}
