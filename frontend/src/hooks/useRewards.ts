import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rewardApi } from '../api/rewardApi';
import type { RewardCreateRequest, RewardUpdateRequest } from '../types/domain';

export function useRewards() {
  return useQuery({ queryKey: ['rewards'], queryFn: rewardApi.list });
}

export function useMyRedemptions() {
  return useQuery({ queryKey: ['redemptions', 'me'], queryFn: rewardApi.myRedemptions });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: number) => rewardApi.redeem(rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['stamps', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['stamps', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['redemptions', 'me'] });
    },
  });
}

export function useCreateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RewardCreateRequest) => rewardApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rewards'] }),
  });
}

export function useUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, body }: { rewardId: number; body: RewardUpdateRequest }) => rewardApi.update(rewardId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rewards'] }),
  });
}

export function useUpdateRewardStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, status }: { rewardId: number; status: 'ACTIVE' | 'INACTIVE' }) => rewardApi.updateStatus(rewardId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rewards'] }),
  });
}
