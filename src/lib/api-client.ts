interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const token = getToken();
  const tenantId = getTenantId();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
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
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
