import { useQuery } from '@tanstack/react-query';
import { missions } from '@/lib/api';
import type { WeeklyMissionData, TotalMissionData } from '@/types/mission';

export const useWeeklyMission = () =>
  useQuery<WeeklyMissionData, Error>({
    queryKey: ['missions', 'weekly'],
    queryFn: missions.weekly,
  });

export const useTotalMission = () =>
  useQuery<TotalMissionData, Error>({
    queryKey: ['missions', 'total'],
    queryFn: missions.total,
  });
