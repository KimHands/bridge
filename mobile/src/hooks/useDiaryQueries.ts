import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diary, keywords as keywordsApi } from '@/lib/api';
import type {
  DiaryListResponse,
  DiaryDetailResponse,
  DiaryCreateResponse,
  DiaryCreateRequest,
  KeywordsResponse,
} from '@/types/diary';

export const useDiaryList = (filter?: { mood?: string; from?: string; to?: string }) =>
  useQuery<DiaryListResponse, Error>({
    queryKey: ['diary', filter],
    queryFn: () => diary.list(filter),
  });

export const useDiaryEntry = (id: string) =>
  useQuery<DiaryDetailResponse, Error>({
    queryKey: ['diary', id],
    queryFn: () => diary.get(id),
    enabled: !!id,
  });

/**
 * 8개 emotion_keyword 전체 + mood_score(1-5)별 추천(highlights) 가져오기.
 * 도메인 정의: 모든 사용자에게 동일한 8개 keyword. mood는 highlights 매핑에만 사용.
 */
export const useEmotionKeywords = () =>
  useQuery<KeywordsResponse, Error>({
    queryKey: ['emotion-keywords'],
    queryFn: () => keywordsApi.emotions(),
    staleTime: Infinity,
  });

export const useCreateDiary = () => {
  const qc = useQueryClient();
  return useMutation<DiaryCreateResponse, Error, DiaryCreateRequest>({
    mutationFn: diary.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useDeleteDiary = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => diary.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary'] }),
  });
};
