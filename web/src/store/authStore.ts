import { create } from 'zustand';

import { apiLogin, apiRegister, apiRefreshToken, AuthApiError } from '../api/auth.ts';
import type { User } from '../types/index.ts';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  init: () => void;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  refresh: () => Promise<boolean>;
}

/** Parse the JWT payload to extract user info (sub, username, isAdmin). */
function parseJwtUser(token: string): User | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return {
      id: decoded.sub ?? '',
      username: decoded.username ?? '',
      isAdmin: decoded.isAdmin ?? false,
      createdAt: '',
    };
  } catch {
    return null;
  }
}

/** Return seconds until the JWT expires, or 0 if unparseable / already expired. */
function tokenExpiresIn(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const decoded = JSON.parse(atob(payload));
    const exp = decoded.exp as number | undefined;
    if (!exp) return 0;
    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearRefreshTimer() {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh(store: typeof useAuthStore) {
  clearRefreshTimer();
  const { accessToken } = store.getState();
  if (!accessToken) return;

  const expiresIn = tokenExpiresIn(accessToken);
  if (expiresIn <= 0) return;

  // Refresh 60 seconds before expiry, but at least 5 seconds from now.
  const delay = Math.max(5, expiresIn - 60) * 1000;

  refreshTimer = setTimeout(() => {
    store.getState().refresh();
  }, delay);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const user = parseJwtUser(accessToken);
    set({ accessToken, refreshToken, user, isAuthenticated: true });
    scheduleRefresh(useAuthStore);
  },

  setUser: (user: User) => {
    set({ user });
  },

  logout: () => {
    clearRefreshTimer();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  init: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (accessToken && refreshToken) {
      const user = parseJwtUser(accessToken);
      set({ accessToken, refreshToken, user, isAuthenticated: true });
      // If the access token is already expired (or close), refresh immediately.
      const expiresIn = tokenExpiresIn(accessToken);
      if (expiresIn <= 60) {
        // Defer to avoid calling refresh before store is fully set up.
        setTimeout(() => {
          get().refresh();
        }, 0);
      } else {
        scheduleRefresh(useAuthStore);
      }
    }
  },

  login: async (username: string, password: string) => {
    const tokens = await apiLogin(username, password);
    get().setTokens(tokens.accessToken, tokens.refreshToken);
  },

  register: async (username: string, password: string) => {
    const tokens = await apiRegister(username, password);
    get().setTokens(tokens.accessToken, tokens.refreshToken);
  },

  refresh: async (): Promise<boolean> => {
    const { refreshToken } = get();
    if (!refreshToken) {
      get().logout();
      return false;
    }
    try {
      const tokens = await apiRefreshToken(refreshToken);
      get().setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        get().logout();
      }
      return false;
    }
  },
}));
