import { apiClient } from './client';
import type { AdminParticipation, MissionParticipation } from '../types/domain';

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다');
  return data as T;
}

export const participationApi = {
  join: async (missionId: number): Promise<MissionParticipation> => {
    const res = await apiClient.post('/participations', { missionId });
    return parseOrThrow<MissionParticipation>(res);
  },
  listMine: async (): Promise<MissionParticipation[]> => {
    const res = await apiClient.get('/participations/me');
    return parseOrThrow<MissionParticipation[]>(res);
  },
  complete: async (participationId: number): Promise<MissionParticipation> => {
    const res = await apiClient.post(`/participations/${participationId}/complete`);
    return parseOrThrow<MissionParticipation>(res);
  },
  confirm: async (participationId: number): Promise<MissionParticipation> => {
    const res = await apiClient.post(`/participations/${participationId}/confirm`);
    return parseOrThrow<MissionParticipation>(res);
  },
  listByMission: async (missionId: number): Promise<AdminParticipation[]> => {
    const res = await apiClient.get(`/participations?missionId=${missionId}`);
    return parseOrThrow<AdminParticipation[]>(res);
  },
};
