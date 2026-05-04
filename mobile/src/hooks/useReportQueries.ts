import { useQuery } from '@tanstack/react-query';
import { reports } from '@/lib/api';
import type { WeeklyReportData, MonthlyReportData, MoodTrendData } from '@/types/report';

export const useWeeklyReport = () =>
  useQuery<WeeklyReportData, Error>({
    queryKey: ['reports', 'weekly'],
    queryFn: reports.weekly,
  });

export const useMonthlyReport = (options?: { enabled?: boolean }) =>
  useQuery<MonthlyReportData, Error>({
    queryKey: ['reports', 'monthly'],
    queryFn: reports.monthly,
    enabled: options?.enabled ?? true,
  });

export const useMoodTrend = (from: string, to: string, options?: { enabled?: boolean }) =>
  useQuery<MoodTrendData, Error>({
    queryKey: ['reports', 'mood-trend', from, to],
    queryFn: () => reports.moodTrend(from, to),
    enabled: options?.enabled ?? true,
  });

// yearly 엔드포인트 없음 — ReportScreen에서 "준비 중" UI로 처리
// useUserStats 제거됨 — /me/stats 백엔드 미구현, MyPageScreen은 missions API 사용
