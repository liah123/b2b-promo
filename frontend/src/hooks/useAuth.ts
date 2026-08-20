import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  return useMutation({ mutationFn: authApi.login });
}
export function useSignup() {
  return useMutation({ mutationFn: authApi.signup });
}
export function useLogout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clear();
      navigate('/login');
    },
  });
}
