// Routine types — mirrors backend app/schemas/routine.py

export type RoutineSource = 'initial' | 'trigger' | 'manual';

/** Single routine item from GET /routines/me */
export interface RoutineItem {
  user_routine_id: string;
  routine_id: number;
  title: string;
  description: string;
  source: RoutineSource;
  is_completed_today: boolean;
  assigned_at: string;
}

/** Returned by GET /routines/me */
export interface RoutineListResponse {
  routines: RoutineItem[];
}

export interface RoutineAddRequest {
  routine_id: number;
}

/** Returned by POST /routines/me */
export interface RoutineAddResponse {
  user_routine_id: string;
  routine_id: number;
  title: string;
  source: RoutineSource;
  assigned_at: string;
}

export interface RoutineCompleteRequest {
  completed: boolean;
}

/** Returned by PATCH /routines/:id/complete */
export interface RoutineCompleteResponse {
  user_routine_id: string;
  completed: boolean;
  logged_at: string;
}

/** Single item from GET /routines/library */
export interface RoutineLibraryItem {
  routine_id: number;
  title: string;
  description: string;
  target_keywords: string[];
  is_already_added: boolean;
}

/** Returned by GET /routines/library */
export interface RoutineLibraryResponse {
  routines: RoutineLibraryItem[];
}
