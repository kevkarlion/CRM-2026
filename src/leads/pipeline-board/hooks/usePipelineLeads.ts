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

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  if (!token) return {};
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': payload.tenantId || 'default',
      'x-user-id': payload.userId || '',
    };
    if (Array.isArray(payload.roles) && payload.roles.length > 0) {
      headers['x-user-roles'] = payload.roles.join(',');
    }
    return headers;
  } catch {
    return { Authorization: `Bearer ${token}` };
  }
}

export function usePipelineLeads(): UsePipelineLeadsReturn {
  const searchParams = useSearchParams();
  const pipelineIdParam = searchParams.get('pipelineId');
  const assignedToParam = searchParams.get('assignedTo');
  const searchParam = searchParams.get('search');
  const createdAtGteParam = searchParams.get('createdAtGte');
  const createdAtLteParam = searchParams.get('createdAtLte');
  const [pipelines, setPipelines] = useState<IPipeline[]>([]);
  const [pipeline, setPipeline] = useState<IPipeline | null>(null);
  const [groups, setGroups] = useState<Record<string, { stage: IPipelineStage; leads: ILead[] }>>({});
  const [unmatched, setUnmatched] = useState<ILead[]>([]);
  const [truncated, setTruncated] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    const res = await fetch('/api/crm/pipelines', {
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Error al cargar pipelines');
    const json = await res.json();
    const data: IPipeline[] = json.data;
    setPipelines(data);
    return data;
  }, []);

  const fetchGrouped = useCallback(async (
    pipelineId: string,
    assignedTo: string | null,
    search: string | null,
    createdAtGte: string | null,
    createdAtLte: string | null,
  ) => {
    const params = new URLSearchParams();
    params.set('pipelineId', pipelineId);

    if (assignedTo) params.set('assignedTo', assignedTo);
    if (search) params.set('search', search);
    if (createdAtGte) params.set('createdAtGte', createdAtGte);
    if (createdAtLte) params.set('createdAtLte', createdAtLte);

    const res = await fetch(`/api/crm/leads/grouped?${params.toString()}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Error al cargar leads del pipeline');
    const data: GroupedResponse = await res.json();
    setPipeline(data.pipeline);
    setGroups(data.groups);
    setUnmatched(data.unmatched);
    setTruncated(data.truncated);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let pipelineId = pipelineIdParam;
      if (!pipelineId) {
        const pipelineList = await fetchPipelines();
        const defaultPipeline = pipelineList.find((p) => p.isDefault) || pipelineList[0];
        if (defaultPipeline) {
          pipelineId = String(defaultPipeline._id);
        }
      }

      if (pipelineId) {
        await fetchGrouped(pipelineId, assignedToParam, searchParam, createdAtGteParam, createdAtLteParam);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPipelines, fetchGrouped, pipelineIdParam, assignedToParam, searchParam, createdAtGteParam, createdAtLteParam]);

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
