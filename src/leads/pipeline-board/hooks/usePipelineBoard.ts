import { useState, useCallback, useEffect, useRef } from 'react';
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
  groups: Record<string, { stage: IPipelineStage; leads: ILead[] }>,
  onRefetch?: () => void,
): UsePipelineBoardReturn {
  const [columns, setColumns] = useState<Record<string, ILead[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const mapped: Record<string, ILead[]> = {};
    for (const [key, group] of Object.entries(groups)) {
      mapped[key] = group.leads;
    }
    setColumns(mapped);
  }, [groups]);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

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

      const currentColumns = columnsRef.current;
      const leadId = String(active.id);
      const targetStageName = String(over.id);

      const lead = findLeadById(leadId, currentColumns);
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

      const previousColumns = structuredClone(currentColumns);

      let sourceStageName: string | null = null;
      for (const [stageName, leads] of Object.entries(currentColumns)) {
        if (leads.some((l) => String(l._id) === leadId)) {
          sourceStageName = stageName;
          break;
        }
      }

      if (!sourceStageName) {
        setActiveId(null);
        return;
      }

      const newColumns = { ...currentColumns };
      newColumns[sourceStageName] = currentColumns[sourceStageName].filter(
        (l) => String(l._id) !== leadId,
      );
      newColumns[targetStageName] = [
        ...currentColumns[targetStageName],
        lead,
      ];
      setColumns(newColumns);

      try {
        let auth: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              auth = {
                Authorization: `Bearer ${token}`,
                'x-tenant-id': payload.tenantId || 'default',
                'x-user-id': payload.userId || '',
              };
              if (Array.isArray(payload.roles) && payload.roles.length > 0) {
                auth['x-user-roles'] = payload.roles.join(',');
              }
            } catch {
              auth = { Authorization: `Bearer ${token}` };
            }
          }
        }
        const res = await fetch(`/api/crm/leads/${leadId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...auth,
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
    [pipelineStages, onRefetch],
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
