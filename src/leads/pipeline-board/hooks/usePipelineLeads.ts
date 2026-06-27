import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IPipeline, IPipelineStage } from '../../types/pipeline';
import type { ILead } from '../../types/lead';

interface GroupedResponse {
  pipeline: IPipeline;
  groups: Record<string, { stage: IPipelineStage; leads: ILead[] }>;
  unmatched: ILead[];
  truncated: Record<string, boolean>;
}

interface UsePipelineLeadsReturn {
  pipeline: IPipeline | null;
  groups: Record<string, { stage: IPipelineStage; leads: ILead[] }>;
  unmatched: ILead[];
  truncated: Record<string, boolean>;
  pipelines: IPipeline[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePipelineLeads(): UsePipelineLeadsReturn {
  const searchParams = useSearchParams();
  const [pipelines, setPipelines] = useState<IPipeline[]>([]);
  const [pipeline, setPipeline] = useState<IPipeline | null>(null);
  const [groups, setGroups] = useState<Record<string, { stage: IPipelineStage; leads: ILead[] }>>({});
  const [unmatched, setUnmatched] = useState<ILead[]>([]);
  const [truncated, setTruncated] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    const res = await fetch('/api/crm/pipelines', {
      headers: { 'x-tenant-id': 'default' },
    });
    if (!res.ok) throw new Error('Error al cargar pipelines');
    const data: IPipeline[] = await res.json();
    setPipelines(data);
    return data;
  }, []);

  const fetchGrouped = useCallback(async (pipelineId: string) => {
    const params = new URLSearchParams();
    params.set('pipelineId', pipelineId);

    const assignedTo = searchParams.get('assignedTo');
    if (assignedTo) params.set('assignedTo', assignedTo);

    const search = searchParams.get('search');
    if (search) params.set('search', search);

    const createdAtGte = searchParams.get('createdAtGte');
    if (createdAtGte) params.set('createdAtGte', createdAtGte);

    const createdAtLte = searchParams.get('createdAtLte');
    if (createdAtLte) params.set('createdAtLte', createdAtLte);

    const res = await fetch(`/api/crm/leads/grouped?${params.toString()}`, {
      headers: { 'x-tenant-id': 'default' },
    });
    if (!res.ok) throw new Error('Error al cargar leads del pipeline');
    const data: GroupedResponse = await res.json();
    setPipeline(data.pipeline);
    setGroups(data.groups);
    setUnmatched(data.unmatched);
    setTruncated(data.truncated);
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let pipelineId = searchParams.get('pipelineId');
      if (!pipelineId) {
        const pipelineList = await fetchPipelines();
        const defaultPipeline = pipelineList.find((p) => p.isDefault) || pipelineList[0];
        if (defaultPipeline) {
          pipelineId = String(defaultPipeline._id);
        }
      }

      if (pipelineId) {
        await fetchGrouped(pipelineId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPipelines, fetchGrouped, searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    pipeline,
    groups,
    unmatched,
    truncated,
    pipelines,
    loading,
    error,
    refetch: fetchData,
  };
}
