// Report types — mirrors backend app/schemas/report.py

/** Single data point in mood trend (date is ISO string "YYYY-MM-DD") */
export interface MoodPoint {
  date: string;
  mood_score: number;
}

/** Returned by GET /reports/weekly */
export interface WeeklyReportData {
  week_start: string;
  week_end: string;
  routine_completion_rate: number;
  mood_average: number | null;
  /** Length 7 — null means no diary that day */
  mood_scores: (number | null)[];
  top_emotion_keywords: string[];
  top_situation_keywords: string[];
  diary_count: number;
}

/** Returned by GET /reports/monthly */
export interface MonthlyReportData {
  year: number;
  month: number;
  routine_completion_rate: number;
  mood_average: number | null;
  mood_trend: MoodPoint[];
  emotion_keyword_distribution: Record<string, number>;
  diary_count: number;
}

/** Returned by GET /reports/mood-trend (if used) */
export interface MoodTrendData {
  trend: MoodPoint[];
}
