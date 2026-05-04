// Diary write flow — Zustand store for the multi-step (mood → keywords → question → memo) wizard.
import { create } from 'zustand';
import type { MoodId } from '@/theme/tokens';

type DiaryDraft = {
  mood: MoodId | null;
  keywords: string[];
  detailAnswer: string;
  memo: string;
  title: string;
};

type DiaryDraftState = DiaryDraft & {
  set: (patch: Partial<DiaryDraft>) => void;
  reset: () => void;
  toggleKeyword: (k: string) => void;
};

const initial: DiaryDraft = { mood: null, keywords: [], detailAnswer: '', memo: '', title: '' };

export const useDiaryDraft = create<DiaryDraftState>((set, get) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
  toggleKeyword: (k) => {
    const cur = get().keywords;
    set({ keywords: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k] });
  },
}));
