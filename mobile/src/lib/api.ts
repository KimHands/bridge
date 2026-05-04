// API client — wraps axios with auth header injection and 401 handling.
// Backend: http://localhost:8000  (FastAPI, all routes under /v1)
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

import type { TokenResponse, RefreshResponse, UserMe, RegisterRequest } from '@/types/auth';
import type { AssessmentRequest, AssessmentResponse, AssessmentHistoryItem, CauseCode } from '@/types/assessment';
import type {
  DiaryCreateRequest,
  DiaryCreateResponse,
  DiaryListResponse,
  DiaryDetailResponse,
  DiaryUpdateResponse,
  KeywordsResponse,
  TodayStatusResponse,
} from '@/types/diary';
import type {
  RoutineListResponse,
  RoutineAddResponse,
  RoutineCompleteResponse,
  RoutineLibraryResponse,
} from '@/types/routine';
import type { WeeklyReportData, MonthlyReportData, MoodTrendData } from '@/types/report';
import type { WeeklyMissionData, TotalMissionData } from '@/types/mission';

export const API_BASE_URL = 'http://localhost:8000/v1';
const TOKEN_KEY = 'bridge.access_token';
const REFRESH_KEY = 'bridge.refresh_token';
const USER_KEY = 'bridge.user';

// ── Token / User helpers ─────────────────────────────────────
export async function getToken()                        { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setToken(t: string)               { return SecureStore.setItemAsync(TOKEN_KEY, t); }
export async function clearToken()                      { return SecureStore.deleteItemAsync(TOKEN_KEY); }
export async function getRefreshToken()                 { return SecureStore.getItemAsync(REFRESH_KEY); }
export async function setRefreshToken(t: string)        { return SecureStore.setItemAsync(REFRESH_KEY, t); }
export async function clearRefreshToken()               { return SecureStore.deleteItemAsync(REFRESH_KEY); }
export async function getStoredUser()                   { const v = await SecureStore.getItemAsync(USER_KEY); return v ? JSON.parse(v) as UserMe : null; }
export async function setStoredUser(u: UserMe)          { return SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)); }
export async function clearStoredUser()                 { return SecureStore.deleteItemAsync(USER_KEY); }

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap { success, data } response + handle 401
api.interceptors.response.use(
  (r) => {
    if (r.data && typeof r.data === 'object' && 'success' in r.data) {
      r.data = r.data.data ?? r.data;
    }
    return r;
  },
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      await clearToken();
      await clearRefreshToken();
      await clearStoredUser();
      const handler = (globalThis as { __bridgeOnAuthExpired?: () => void }).__bridgeOnAuthExpired;
      if (typeof handler === 'function') handler();
    }
    return Promise.reject(err);
  },
);

// ── Endpoint helpers ─────────────────────────────────────────

export const auth = {
  // POST /auth/register  → TokenResponse
  signup: (p: RegisterRequest): Promise<TokenResponse> =>
    api.post<TokenResponse>('/auth/register', p).then(r => r.data),

  // POST /auth/login  → TokenResponse
  login: (email: string, password: string): Promise<TokenResponse> =>
    api.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data),

  // GET /auth/me  → UserMe
  me: (): Promise<UserMe> =>
    api.get<UserMe>('/auth/me').then(r => r.data),

  // POST /auth/logout
  logout: (refreshToken: string): Promise<void> =>
    api.post<void>('/auth/logout', { refresh_token: refreshToken }).then(r => r.data),

  // POST /auth/refresh  → RefreshResponse
  refresh: (refreshToken: string): Promise<RefreshResponse> =>
    api.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }).then(r => r.data),
};

export const assessments = {
  // POST /assessments  → AssessmentResponse
  submit: (phq9_answers: number[], primary_cause: CauseCode): Promise<AssessmentResponse> =>
    api.post<AssessmentResponse>('/assessments', { phq9_answers, primary_cause } satisfies AssessmentRequest).then(r => r.data),

  // GET /assessments  → AssessmentHistoryItem[]
  latest: (): Promise<AssessmentHistoryItem[]> =>
    api.get<AssessmentHistoryItem[]>('/assessments').then(r => r.data),
};

export const routines = {
  // GET /routines/me  → RoutineListResponse
  list: (): Promise<RoutineListResponse> =>
    api.get<RoutineListResponse>('/routines/me').then(r => r.data),

  // POST /routines/me  → RoutineAddResponse
  addFromLibrary: (routine_id: number): Promise<RoutineAddResponse> =>
    api.post<RoutineAddResponse>('/routines/me', { routine_id }).then(r => r.data),

  // PATCH /routines/:user_routine_id/complete  → RoutineCompleteResponse
  complete: (id: string): Promise<RoutineCompleteResponse> =>
    api.patch<RoutineCompleteResponse>(`/routines/${id}/complete`, { completed: true }).then(r => r.data),

  uncomplete: (id: string): Promise<RoutineCompleteResponse> =>
    api.patch<RoutineCompleteResponse>(`/routines/${id}/complete`, { completed: false }).then(r => r.data),

  // DELETE /routines/:user_routine_id
  delete: (id: string): Promise<void> =>
    api.delete<void>(`/routines/${id}`).then(r => r.data),

  // GET /routines/library  → RoutineLibraryResponse
  library: (): Promise<RoutineLibraryResponse> =>
    api.get<RoutineLibraryResponse>('/routines/library').then(r => r.data),
};

export const diary = {
  // GET /diaries  → DiaryListResponse
  list: (filter?: { mood?: string; from?: string; to?: string }): Promise<DiaryListResponse> =>
    api.get<DiaryListResponse>('/diaries', { params: filter }).then(r => r.data),

  // GET /diaries/:id  → DiaryDetailResponse
  get: (id: string): Promise<DiaryDetailResponse> =>
    api.get<DiaryDetailResponse>(`/diaries/${id}`).then(r => r.data),

  // GET /diaries/today/status  → TodayStatusResponse
  todayStatus: (): Promise<TodayStatusResponse> =>
    api.get<TodayStatusResponse>('/diaries/today/status').then(r => r.data),

  // POST /diaries  → DiaryCreateResponse
  create: (p: DiaryCreateRequest): Promise<DiaryCreateResponse> =>
    api.post<DiaryCreateResponse>('/diaries', p).then(r => r.data),

  // PATCH /diaries/:id  → DiaryUpdateResponse
  update: (id: string, p: Partial<DiaryCreateRequest>): Promise<DiaryUpdateResponse> =>
    api.patch<DiaryUpdateResponse>(`/diaries/${id}`, p).then(r => r.data),

  // DELETE /diaries/:id
  delete: (id: string): Promise<void> =>
    api.delete<void>(`/diaries/${id}`).then(r => r.data),
};

export const reports = {
  // GET /reports/weekly  → WeeklyReportData
  weekly: (): Promise<WeeklyReportData> =>
    api.get<WeeklyReportData>('/reports/weekly').then(r => r.data),

  // GET /reports/monthly  → MonthlyReportData
  monthly: (): Promise<MonthlyReportData> =>
    api.get<MonthlyReportData>('/reports/monthly').then(r => r.data),

  // GET /reports/mood-trend?from=YYYY-MM-DD&to=YYYY-MM-DD  → MoodTrendData
  moodTrend: (from: string, to: string): Promise<MoodTrendData> =>
    api.get<MoodTrendData>('/reports/mood-trend', { params: { from, to } }).then(r => r.data),

  // yearly 엔드포인트 없음 — "준비 중" UI로 처리
};

export const missions = {
  // GET /missions/weekly  → WeeklyMissionData
  weekly: (): Promise<WeeklyMissionData> =>
    api.get<WeeklyMissionData>('/missions/weekly').then(r => r.data),

  // GET /missions/total  → TotalMissionData
  total: (): Promise<TotalMissionData> =>
    api.get<TotalMissionData>('/missions/total').then(r => r.data),
};

export const keywords = {
  // GET /keywords/emotions  → KeywordsResponse (8개 emotion_keyword + mood별 highlights)
  emotions: (): Promise<KeywordsResponse> =>
    api.get<KeywordsResponse>('/keywords/emotions').then(r => r.data),
};

export const me = {
  // PATCH /auth/me
  update: (p: { nickname?: string }): Promise<UserMe> =>
    api.patch<UserMe>('/auth/me', p).then(r => r.data),
  // /me/stats 엔드포인트 없음 — 통계는 missions.weekly + diary.list 조합으로 대체
};

// ── Error helpers ────────────────────────────────────────────
// 백엔드는 모든 에러를 HTTPException(detail={code, message}) 포맷으로 반환.
// 호출자가 catch 블록에서 일관된 분기/메시지 표시할 수 있도록 추출 헬퍼 제공.

export interface ApiError {
  code?: string;
  message: string;
  status?: number;
}

export function getApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const d = detail as { code?: string; message?: string };
      return { code: d.code, message: d.message ?? '요청을 처리하지 못했어요.', status: err.response?.status };
    }
    if (typeof detail === 'string') {
      return { message: detail, status: err.response?.status };
    }
    return { message: err.message || '네트워크 오류가 발생했어요.', status: err.response?.status };
  }
  return { message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요.' };
}

// ── Mood mapping utilities ───────────────────────────────────
// 도메인 정의: mood_score는 5단계 척도 (매우 나쁨 ~ 매우 좋음).
// emotion_keywords (8개)와는 완전히 독립된 모델. 자동 매핑 금지.

export type MoodKey = 'verybad' | 'bad' | 'normal' | 'good' | 'verygood';

export const MOOD_TO_SCORE: Record<MoodKey, number> = {
  verybad:  1,
  bad:      2,
  normal:   3,
  good:     4,
  verygood: 5,
};
