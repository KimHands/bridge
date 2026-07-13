// React Query 싱글턴 — App.tsx와 store/auth.ts가 공유한다.
// 로그아웃/탈퇴/세션만료 시 store에서 queryClient.clear()로 이전 사용자 캐시를 비운다
// (같은 기기에서 다른 사용자가 이전 사용자의 일기·감정·챗 캐시를 보는 것을 방지).
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
