// ── Hook para cargar datos del dashboard ───────────────────

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseDashboardDataOptions {
  /** Time in ms to auto-reload (0 = no auto-reload) */
  pollInterval?: number;
}

export function useDashboardData<T>(
  fetcher: () => Promise<T>,
  options: UseDashboardDataOptions = {},
) {
  const { pollInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    load();
    if (pollInterval > 0) {
      const id = setInterval(load, pollInterval);
      return () => clearInterval(id);
    }
  }, [load, pollInterval]);

  return { data, loading, error, refetch: load };
}
