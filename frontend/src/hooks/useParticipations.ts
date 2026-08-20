import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { participationApi } from '../api/participationApi';

export function useJoinMission(missionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => participationApi.join(missionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions', missionId] });
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useMyParticipations() {
  return useQuery({ queryKey: ['participations', 'me'], queryFn: participationApi.listMine });
}

export function useCompleteParticipation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participationId: number) => participationApi.complete(participationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['stamps', 'balance'] });
    },
  });
}

export function useMissionParticipations(missionId: number | null) {
  return useQuery({
    queryKey: ['participations', 'byMission', missionId],
    queryFn: () => participationApi.listByMission(missionId as number),
    enabled: missionId != null,
  });
}

export function useConfirmParticipation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participationId: number) => participationApi.confirm(participationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participations', 'byMission'] });
    },
  });
}
