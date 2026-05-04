// Diary types — mirrors backend app/schemas/diary.py

/** 1(최악) ~ 5(최고) */
export type MoodScore = 1 | 2 | 3 | 4 | 5;

/** 백엔드 KEYWORD_META 정의 (8개 emotion_keyword) */
export interface EmotionKeywordItem {
  name: string;
  category: 'positive' | 'negative';
  question: string;
  answers: string[];
}

/** GET /v1/keywords/emotions 응답 */
export interface KeywordsResponse {
  keywords: EmotionKeywordItem[];
  /** mood_score (1-5) → 추천 emotion_keyword 2개 */
  highlights_by_mood: Record<string, string[]>;
}

export interface SituationKeywordInput {
  emotion_keyword: string;
  answer: string;
}

export interface SituationKeywordOutput {
  emotion_keyword: string;
  answer: string;
}

export interface DiaryCreateRequest {
  mood_score: MoodScore;
  emotion_keywords: string[];
  situation_keywords?: SituationKeywordInput[];
  memo?: string | null;
}

export interface DiaryUpdateRequest {
  mood_score?: MoodScore | null;
  emotion_keywords?: string[] | null;
  situation_keywords?: SituationKeywordInput[] | null;
  memo?: string | null;
}

/** Returned by POST /diaries */
export interface DiaryCreateResponse {
  diary_id: string;
  mood_score: MoodScore;
  emotion_keywords: string[];
  situation_keywords: SituationKeywordOutput[];
  created_at: string;
  trigger_executed: boolean;
}

/** Returned by PATCH /diaries/:id */
export interface DiaryUpdateResponse {
  diary_id: string;
  updated_at: string;
}

/** Single item in GET /diaries list */
export interface DiaryListItem {
  diary_id: string;
  mood_score: MoodScore;
  emotion_keywords: string[];
  memo_preview: string | null;
  created_at: string;
}

/** Returned by GET /diaries (cursor-based) */
export interface DiaryListResponse {
  items: DiaryListItem[];
  cursor: string | null;
  has_next: boolean;
}

/** Returned by GET /diaries/:id */
export interface DiaryDetailResponse {
  diary_id: string;
  mood_score: MoodScore;
  emotion_keywords: string[];
  situation_keywords: SituationKeywordOutput[];
  memo: string | null;
  created_at: string;
}

/** Returned by GET /diaries/today-status */
export interface TodayStatusResponse {
  has_diary_today: boolean;
  diary_id: string | null;
  mood_score: MoodScore | null;
}
