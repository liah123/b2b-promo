import { useAuthStore } from '../store/authStore';

const BASE_URL = 'http://localhost:3000';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        return data.accessToken as string;
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(path: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      useAuthStore.getState().setAccessToken(newToken);
      return request(path, init, true);
    }
    useAuthStore.getState().clear();
    window.location.href = '/login';
    return res;
  }

  return res;
}

export const apiClient = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
