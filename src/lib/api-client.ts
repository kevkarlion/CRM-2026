interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown, isFormData?: boolean): Promise<T>;
  put<T>(path: string, body: unknown, isFormData?: boolean): Promise<T>;
  patch<T>(path: string, body: unknown, isFormData?: boolean): Promise<T>;
  del<T>(path: string): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

/**
 * Normalizes API response to handle double-wrapping:
 * - { data: [...] } -> [...]
 * - { data: { data: [...] } } -> [...]
 * - [...] -> [...]
 */
export function unwrapData<T>(response: unknown): T {
  if (!response || typeof response !== 'object') {
    return [] as T;
  }
  // If the response is already a plain array (some endpoints return it directly),
  // return it as-is — do NOT look for a .data wrapper.
  if (Array.isArray(response)) {
    return response as T;
  }
  const resp = response as Record<string, unknown>;
  const data = resp.data;
  // If data is another wrapper, unwrap again
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as Record<string, unknown>).data as T;
  }
  // If data is an array, return it
  if (Array.isArray(data)) {
    return data as T;
  }
  // If data is already the direct value
  return data as T;
}

function getToken(): string | null {
  try {
    const storage = (globalThis as Record<string, unknown>).localStorage as { getItem(k: string): string | null } | undefined;
    return storage?.getItem('token') ?? null;
  } catch {
    return null;
  }
}

function getTenantId(): string | null {
  try {
    const storage = (globalThis as Record<string, unknown>).localStorage as { getItem(k: string): string | null } | undefined;
    // First try to get from localStorage directly
    const stored = storage?.getItem('tenantId');
    if (stored) return stored;
    
    // If not found, try to extract from JWT token
    const token = storage?.getItem('token') ?? null;
    if (!token) return null;
    
    // Decode JWT to get tenantId (payload is in the second part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    try {
      const payload = JSON.parse(atob(parts[1]));
      return payload.tenantId ?? null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function getUserId(): string | null {
  try {
    const storage = (globalThis as Record<string, unknown>).localStorage as { getItem(k: string): string | null } | undefined;
    const token = storage?.getItem('token') ?? null;
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    try {
      const payload = JSON.parse(atob(parts[1]));
      return payload.userId ?? null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
  isFormData?: boolean,
): Promise<T> {
  const token = getToken();
  const tenantId = getTenantId();
  const userId = getUserId();
  const headers: Record<string, string> = {};

  console.log('[api-client] token:', !!token, 'tenantId:', tenantId, 'userId:', userId);

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
    console.log('[api-client] Setting x-tenant-id header:', tenantId);
  }

  if (userId) {
    headers['x-user-id'] = userId;
    console.log('[api-client] Setting x-user-id header:', userId);
  }

  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, value);
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  if (body !== undefined) {
    if (isFormData && body instanceof FormData) {
      // Let fetch set the Content-Type automatically for FormData (includes boundary)
    } else {
      headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? (isFormData && body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api: ApiClient = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>('GET', path, undefined, params),
  post: <T>(path: string, body: unknown, isFormData?: boolean) => request<T>('POST', path, body, undefined, isFormData),
  put: <T>(path: string, body: unknown, isFormData?: boolean) => request<T>('PUT', path, body, undefined, isFormData),
  patch: <T>(path: string, body: unknown, isFormData?: boolean) => request<T>('PATCH', path, body, undefined, isFormData),
  del: <T>(path: string) => request<T>('DELETE', path),
  delete: <T>(path: string) => request<T>('DELETE', path), // alias
};
