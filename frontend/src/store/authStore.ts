// ponytail: 새로고침 세션 복구 안 함 — BE-12(GET /users/me) 붙으면 App.tsx에 부트스트랩 추가
import { create } from 'zustand';
import type { User } from '../types/domain';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, accessToken: null }),
}));
