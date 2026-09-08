import type { AuthTokensResponse, AuthUserResponse } from '@lms/shared';
import { create } from 'zustand';
import { setAccessTokenGetter, setAuthRefreshHandlers } from '../../api/client';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUserResponse | null;
  loginSuccess: (tokens: AuthTokensResponse) => void;
  logoutLocal: () => void;
};

const storageKeys = {
  accessToken: 'lms.accessToken',
  refreshToken: 'lms.refreshToken',
  user: 'lms.user',
} as const;

export const useAuthStore = create<AuthState>((set, get) => {
  setAccessTokenGetter(() => get().accessToken);
  setAuthRefreshHandlers({
    getRefreshToken: () => get().refreshToken,
    onRefreshFailure: () => get().logoutLocal(),
    onRefreshSuccess: (tokens) => get().loginSuccess(tokens),
  });

  return {
    accessToken: readStorage(storageKeys.accessToken),
    refreshToken: readStorage(storageKeys.refreshToken),
    user: readJsonStorage<AuthUserResponse>(storageKeys.user),
    loginSuccess: (tokens) => {
      localStorage.setItem(storageKeys.accessToken, tokens.accessToken);
      localStorage.setItem(storageKeys.refreshToken, tokens.refreshToken);
      localStorage.setItem(storageKeys.user, JSON.stringify(tokens.user));
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user,
      });
    },
    logoutLocal: () => {
      localStorage.removeItem(storageKeys.accessToken);
      localStorage.removeItem(storageKeys.refreshToken);
      localStorage.removeItem(storageKeys.user);
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
});

function readStorage(key: string): string | null {
  return localStorage.getItem(key);
}

function readJsonStorage<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
