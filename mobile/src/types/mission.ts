// Mission types — mirrors backend app/schemas/mission.py

/** Returned by GET /missions/weekly */
export interface WeeklyMissionData {
  week_year: string;
  routine_days: number;
  diary_days: number;
  weekly_score: number;
  total_score: number;
  is_achieved: boolean;
}

/** Single item in weekly history list */
export interface WeeklyHistoryItem {
  week_year: string;
  weekly_score: number;
  is_achieved: boolean;
}

/** Returned by GET /missions/total */
export interface TotalMissionData {
  total_score: number;
  weekly_history: WeeklyHistoryItem[];
}
