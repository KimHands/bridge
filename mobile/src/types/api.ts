// Common API wrapper types — mirrors backend app/schemas/auth.py SuccessResponse[T]

export interface SuccessResponse<T> {
  success: true;
  data: T | null;
  message: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

/** Cursor-based pagination envelope used by diary list */
export interface CursorPage<T> {
  items: T[];
  cursor: string | null;
  has_next: boolean;
}

/** Generic pagination metadata (reserved for future offset-based endpoints) */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
}
