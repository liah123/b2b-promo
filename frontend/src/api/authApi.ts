import { apiClient } from './client';
import type { User } from '../types/domain';

export interface SignupRequest { email: string; password: string; name: string; }
export interface LoginRequest { email: string; password: string; }
export interface AuthResponse { accessToken: string; user: User; }

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const authApi = {
  signup: async (body: SignupRequest): Promise<User> => {
    const res = await apiClient.post('/auth/signup', body);
    return parseOrThrow<User>(res);
  },
  login: async (body: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', body);
    return parseOrThrow<AuthResponse>(res);
  },
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
