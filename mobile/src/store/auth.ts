// Auth store — token persistence via expo-secure-store
import { create } from 'zustand';
import {
  auth,
  me,
  notifications,
  getToken, setToken, clearToken,
  getRefreshToken, setRefreshToken, clearRefreshToken,
  getStoredUser, setStoredUser, clearStoredUser,
} from '@/lib/api';
import { getExpoPushToken } from '@/lib/notifications';

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
  deleteAccount: (password: string) => Promise<void>;
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
    // Step 1: Deactivate push token (still has JWT)
    try {
      const token = await getExpoPushToken();
      if (token) {
        await notifications.deactivateToken(token);
      }
    } catch (e) {
      console.warn('[auth] failed to deactivate push token:', e);
      // logout 자체는 계속 진행
    }

    // Step 2: Clear local tokens
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) await auth.logout(refreshToken);
    } catch { /* ignore */ }
    await clearToken();
    await clearRefreshToken();
    await clearStoredUser();
    set({ user: null, token: null });
  },

  deleteAccount: async (password) => {
    // 서버에서 비밀번호 재확인 후 모든 개인정보 즉시 파기. 실패 시 예외를 그대로 전파.
    await me.deleteAccount(password);
    // 성공 시 푸시 토큰 비활성화 시도(서버 데이터는 이미 삭제됨, best-effort).
    try {
      const token = await getExpoPushToken();
      if (token) await notifications.deactivateToken(token);
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
