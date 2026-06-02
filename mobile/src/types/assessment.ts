// Assessment types — mirrors backend app/schemas/assessment.py

export type CauseCode =
  | 'sleep'
  | 'academic'
  | 'future'
  | 'financial'
  | 'relationship'
  | 'physical'
  | 'unknown';

/** PHQ-9 tier derived from phq9_level (1~4) — kept numeric to avoid medical label exposure */
export type AssessmentTier = 1 | 2 | 3 | 4;

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

/** Returned by POST /assessments */
export interface AssessmentResponse {
  assessment_id: string;
  phq9_score: number;
  phq9_level: AssessmentTier;
  primary_cause: CauseCode;
  needs_professional_flag: boolean;
  assigned_routines: AssignedRoutineItem[];
}

/** Single item from GET /assessments history list */
export interface AssessmentHistoryItem {
  assessment_id: string;
  phq9_score: number;
  phq9_level: AssessmentTier;
  primary_cause: CauseCode;
  needs_professional_flag: boolean;
  taken_at: string;
}
