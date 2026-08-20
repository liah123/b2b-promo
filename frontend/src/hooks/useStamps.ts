import { useQuery } from '@tanstack/react-query';
import { stampApi } from '../api/stampApi';

export function useStampBalance() {
  return useQuery({ queryKey: ['stamps', 'balance'], queryFn: stampApi.getBalance });
}
export function useStampHistory() {
  return useQuery({ queryKey: ['stamps', 'history'], queryFn: stampApi.getHistory });
}
