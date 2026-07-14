// Assessment types — mirrors backend app/schemas/assessment.py

export type CauseCode =
  | 'sleep'
  | 'academic'
  | 'future'
  | 'financial'
  | 'relationship'
  | 'physical'
  | 'unknown';

export interface AssessmentRequest {
  phq9_answers: number[];
  primary_cause: CauseCode;
  secondary_cause?: CauseCode | null;
}

export interface AssignedRoutineItem {
  routine_id: number;
  title: string;
  category: string;
}

/**
 * Returned by POST /assessments.
 * 데이터 최소화(M3): 임상 구간(phq9_level)·원점수는 서버가 보내지 않는다.
 * 비임상 문구(result_short/result_note)와 전문가 연계 플래그만 받는다.
 */
export interface AssessmentResponse {
  assessment_id: string;
  primary_cause: CauseCode;
  needs_professional_flag: boolean;
  recommend_professional: boolean;
  result_short: string;
  result_note: string;
  assigned_routines: AssignedRoutineItem[];
}

/** Single item from GET /assessments history list */
export interface AssessmentHistoryItem {
  assessment_id: string;
  primary_cause: CauseCode;
  needs_professional_flag: boolean;
  recommend_professional: boolean;
  result_short: string;
  result_note: string;
  taken_at: string;
}
