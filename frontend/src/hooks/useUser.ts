import { useMutation } from '@tanstack/react-query';
import { userApi } from '../api/userApi';

export function useUpdateMe() {
  return useMutation({ mutationFn: userApi.updateMe });
}
export function useUpdatePassword() {
  return useMutation({ mutationFn: userApi.updatePassword });
}
