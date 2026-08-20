import { apiClient } from './client';
import type { User } from '../types/domain';

export interface UserUpdateRequest { name: string; }
export interface PasswordUpdateRequest { currentPassword: string; newPassword: string; }

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const userApi = {
  updateMe: async (body: UserUpdateRequest): Promise<User> => {
    const res = await apiClient.patch('/users/me', body);
    return parseOrThrow<User>(res);
  },
  updatePassword: async (body: PasswordUpdateRequest): Promise<void> => {
    const res = await apiClient.patch('/users/me/password', body);
    return parseOrThrow<void>(res);
  },
};
