// Auth store — token persistence via expo-secure-store
import { create } from 'zustand';
import {
  auth,
  getToken, setToken, clearToken,
  getRefreshToken, setRefreshToken, clearRefreshToken,
  getStoredUser, setStoredUser, clearStoredUser,
} from '@/lib/api';

export type User = {
  user_id: string;
  email: string;
  nickname: string;
  requires_assessment: boolean;
};

// Backend TokenResponse (after interceptor unwrap)
type TokenPayload = {
  user_id: string;
  nickname: string;
  access_token: string;
  refresh_token: string;
  requires_assessment: boolean;
};

type AuthState = {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  signup: (p: { email: string; password: string; nickname: string }) => Promise<User>;
  logout: () => Promise<void>;
};

function tokenPayloadToUser(payload: TokenPayload): User {
  return {
    user_id: payload.user_id,
    email: '',
    nickname: payload.nickname,
    requires_assessment: payload.requires_assessment,
  };
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  hydrate: async () => {
    const token = await getToken();
    if (!token) { set({ hydrated: true }); return; }
    try {
      const data = await auth.me();
      const user: User = {
        user_id: data.user_id,
        email: data.email ?? '',
        nickname: data.nickname,
        requires_assessment: data.requires_assessment,
      };
      await setStoredUser(user);
      set({ user, token, hydrated: true });
    } catch {
      await clearToken();
      await clearRefreshToken();
      await clearStoredUser();
      set({ user: null, token: null, hydrated: true });
    }
  },

  login: async (email, password) => {
    const payload: TokenPayload = await auth.login(email, password);
    await setToken(payload.access_token);
    await setRefreshToken(payload.refresh_token);
    const user = tokenPayloadToUser(payload);
    await setStoredUser(user);
    set({ user, token: payload.access_token });
    return user;
  },

  signup: async (p) => {
    const payload: TokenPayload = await auth.signup(p);
    await setToken(payload.access_token);
    await setRefreshToken(payload.refresh_token);
    const user = tokenPayloadToUser(payload);
    await setStoredUser(user);
    set({ user, token: payload.access_token });
    return user;
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) await auth.logout(refreshToken);
    } catch { /* ignore */ }
    await clearToken();
    await clearRefreshToken();
    await clearStoredUser();
    set({ user: null, token: null });
  },
}));

// Wire api.ts 401-handler into the store
(globalThis as any).__bridgeOnAuthExpired = () => {
  useAuth.setState({ user: null, token: null });
};
