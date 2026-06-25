// ── Client-side fetch wrappers for dashboard API ───────────

import type {
  SummaryResponse,
  OperationsResponse,
  CommercialResponse,
  ContractsResponse,
} from '../../types/metrics';

const BASE = '/api/dashboard';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'x-tenant-id': 'default' } });
  if (!res.ok) {
    throw new Error(`Dashboard API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSummary(): Promise<SummaryResponse> {
  return fetchJson<SummaryResponse>(`${BASE}/summary`);
}

export async function fetchOperations(): Promise<OperationsResponse> {
  return fetchJson<OperationsResponse>(`${BASE}/operations`);
}

export async function fetchCommercial(): Promise<CommercialResponse> {
  return fetchJson<CommercialResponse>(`${BASE}/commercial`);
}

export async function fetchContracts(): Promise<ContractsResponse> {
  return fetchJson<ContractsResponse>(`${BASE}/contracts`);
}
