import { apiClient } from './client';
import type { Mission, MissionCreateRequest, MissionUpdateRequest } from '../types/domain';

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const missionApi = {
  list: async (): Promise<Mission[]> => {
    const res = await apiClient.get('/missions');
    return parseOrThrow<Mission[]>(res);
  },
  get: async (missionId: number): Promise<Mission> => {
    const res = await apiClient.get(`/missions/${missionId}`);
    return parseOrThrow<Mission>(res);
  },
  create: async (body: MissionCreateRequest): Promise<Mission> => {
    const res = await apiClient.post('/missions', body);
    return parseOrThrow<Mission>(res);
  },
  update: async (missionId: number, body: MissionUpdateRequest): Promise<Mission> => {
    const res = await apiClient.patch(`/missions/${missionId}`, body);
    return parseOrThrow<Mission>(res);
  },
  updateStatus: async (missionId: number, status: 'ENDED'): Promise<Mission> => {
    const res = await apiClient.patch(`/missions/${missionId}/status`, { status });
    return parseOrThrow<Mission>(res);
  },
};
