import { apiClient } from './client';
import type { StampBalance, StampTransaction } from '../types/domain';

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const stampApi = {
  getBalance: async (): Promise<StampBalance[]> => {
    const res = await apiClient.get('/stamps/balance');
    return parseOrThrow<StampBalance[]>(res);
  },
  getHistory: async (): Promise<StampTransaction[]> => {
    const res = await apiClient.get('/stamps/history');
    return parseOrThrow<StampTransaction[]>(res);
  },
};
