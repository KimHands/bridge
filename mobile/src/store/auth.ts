// Auth store — token persistence via expo-secure-store
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import {
  auth,
  me,
  notifications,
  getToken, setToken, clearToken,
  getRefreshToken, setRefreshToken, clearRefreshToken,
  getStoredUser, setStoredUser, clearStoredUser,
  getDeviceSecret, setDeviceSecret, clearDeviceSecret,
} from '@/lib/api';
import { getExpoPushToken } from '@/lib/notifications';
import { queryClient } from '@/lib/queryClient';

export type User = {
  user_id: string;
  email: string;
  nickname: string;
  requires_assessment: boolean;
  // 백엔드 /auth/me는 is_anonymous를 내려주지 않아 클라이언트가 로컬로만 추적한다.
  is_anonymous: boolean;
};

// 기기별 256-bit 랜덤 시크릿을 생성해 hex 문자열로 반환한다.
// (base64 대신 hex — RN 기본 환경엔 Buffer/btoa 폴리필이 없어 추가 의존성 없이 안전하게 인코딩)
async function generateDeviceSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 저장된 device_secret이 있으면 재사용, 없으면 새로 생성해 SecureStore에 저장.
async function getOrCreateDeviceSecret(): Promise<string> {
  const existing = await getDeviceSecret();
  if (existing) return existing;
  const created = await generateDeviceSecret();
  await setDeviceSecret(created);
  return created;
}

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
  // 승격(계정 만들기) 완료 후 로컬 상태 갱신 — 서버는 계속 같은 user_id를 사용해 기록을 보존한다.
  markUpgraded: () => Promise<void>;
};

function tokenPayloadToUser(payload: TokenPayload, is_anonymous: boolean): User {
  return {
    user_id: payload.user_id,
    email: '',
    nickname: payload.nickname,
    requires_assessment: payload.requires_assessment,
    is_anonymous,
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,

  hydrate: async () => {
    const token = await getToken();

    if (!token) {
      // 저장된 세션이 없으면 회원가입을 강제하지 않고 기기 시크릿으로 익명 세션을 바로 생성한다("바로 시작").
      // 기존 email 로그인 사용자는 이 분기와 무관 — 토큰이 남아있는 한 아래 분기로 간다.
      try {
        const deviceSecret = await getOrCreateDeviceSecret();
        const payload: TokenPayload = await auth.anonymous(deviceSecret);
        await setToken(payload.access_token);
        await setRefreshToken(payload.refresh_token);
        const user = tokenPayloadToUser(payload, true);
        await setStoredUser(user, true);
        set({ user, token: payload.access_token, hydrated: true });
      } catch (e) {
        // 네트워크 오류 등으로 부트스트랩 실패 시 기존처럼 로그인/온보딩 화면으로 폴백.
        console.warn('[auth] anonymous bootstrap failed:', e);
        set({ hydrated: true });
      }
      return;
    }

    try {
      const data = await auth.me();
      // is_anonymous는 백엔드가 내려주지 않으므로 로컬 캐시 값을 승계한다(없으면 보수적으로 익명 취급하지 않음).
      const cached = await getStoredUser();
      const is_anonymous = cached?.is_anonymous ?? false;
      const user: User = {
        user_id: data.user_id,
        email: data.email ?? '',
        nickname: data.nickname,
        requires_assessment: data.requires_assessment,
        is_anonymous,
      };
      await setStoredUser(user, is_anonymous);
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
    const user = tokenPayloadToUser(payload, false);
    await setStoredUser(user, false);
    set({ user, token: payload.access_token });
    return user;
  },

  signup: async (p) => {
    const payload: TokenPayload = await auth.signup(p);
    await setToken(payload.access_token);
    await setRefreshToken(payload.refresh_token);
    const user = tokenPayloadToUser(payload, false);
    await setStoredUser(user, false);
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
    // device_secret도 함께 폐기 — 남겨두면 다음 앱 실행 시 hydrate()의 익명 부트스트랩이
    // 같은 기기 시크릿으로 방금 로그아웃한 계정에 비밀번호 없이 재로그인시켜 버린다.
    await clearDeviceSecret();
    queryClient.clear(); // 이전 사용자 캐시 제거 (같은 기기 재로그인 시 데이터 유출 방지)
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
    await clearDeviceSecret(); // 삭제된 계정과 같은 신원으로 재부트스트랩되지 않도록 함께 폐기
    queryClient.clear(); // 이전 사용자 캐시 제거
    set({ user: null, token: null });
  },

  markUpgraded: async () => {
    const current = get().user;
    if (!current) return;
    const user: User = { ...current, is_anonymous: false };
    await setStoredUser(user, false);
    set({ user });
  },
}));

// Wire api.ts 401-handler into the store
(globalThis as any).__bridgeOnAuthExpired = () => {
  queryClient.clear(); // 세션 만료 — 다음 로그인(다른 사용자 가능) 전 캐시 비움
  useAuth.setState({ user: null, token: null });
};
