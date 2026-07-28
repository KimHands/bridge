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

/** state: assigned=루틴 배정됨 / cooldown=최근 배정 직후(쿨다운) / no_routine=배정 불가(호흡 안내로 대체) */
export type RoutineRequestState = 'assigned' | 'cooldown' | 'no_routine';

/** POST /routines/request 배정 시 루틴 정보 — RoutineItem과 달리 user_routine_id/source 없음(백엔드 RoutineOut 그대로) */
export interface RoutineRequestRoutine {
  routine_id: number;
  title: string;
  description: string;
}

/** Returned by POST /routines/request */
export interface RoutineRequestResponse {
  assigned: RoutineRequestRoutine | null;
  state: RoutineRequestState;
  /** true면 "사람과 이야기하기"(SupportConnect) 도입부 노출 */
  offer_connection: boolean;
  /** true면 요청 빈도가 잦다는 신호(부드러운 안내용, UI 필수 아님) */
  nudge: boolean;
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
