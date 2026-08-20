import { apiClient } from './client';
import type { Reward, RewardCreateRequest, RewardRedemption, RewardUpdateRequest } from '../types/domain';

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const rewardApi = {
  list: async (): Promise<Reward[]> => {
    const res = await apiClient.get('/rewards');
    return parseOrThrow<Reward[]>(res);
  },
  redeem: async (rewardId: number): Promise<RewardRedemption> => {
    const res = await apiClient.post('/redemptions', { rewardId });
    return parseOrThrow<RewardRedemption>(res);
  },
  myRedemptions: async (): Promise<RewardRedemption[]> => {
    const res = await apiClient.get('/redemptions/me');
    return parseOrThrow<RewardRedemption[]>(res);
  },
  create: async (body: RewardCreateRequest): Promise<Reward> => {
    const res = await apiClient.post('/rewards', body);
    return parseOrThrow<Reward>(res);
  },
  update: async (rewardId: number, body: RewardUpdateRequest): Promise<Reward> => {
    const res = await apiClient.patch(`/rewards/${rewardId}`, body);
    return parseOrThrow<Reward>(res);
  },
  updateStatus: async (rewardId: number, status: 'ACTIVE' | 'INACTIVE'): Promise<Reward> => {
    const res = await apiClient.patch(`/rewards/${rewardId}/status`, { status });
    return parseOrThrow<Reward>(res);
  },
};
