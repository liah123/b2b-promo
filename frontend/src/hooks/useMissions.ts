import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { missionApi } from '../api/missionApi';
import type { MissionCreateRequest, MissionUpdateRequest } from '../types/domain';

export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: missionApi.list });
}
export function useMission(missionId: number) {
  return useQuery({ queryKey: ['missions', missionId], queryFn: () => missionApi.get(missionId), enabled: !!missionId });
}

export function useCreateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MissionCreateRequest) => missionApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['missions'] }),
  });
}
export function useUpdateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ missionId, body }: { missionId: number; body: MissionUpdateRequest }) => missionApi.update(missionId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['missions'] }),
  });
}
export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (missionId: number) => missionApi.updateStatus(missionId, 'ENDED'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['missions'] }),
  });
}
