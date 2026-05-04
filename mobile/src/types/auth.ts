// Auth types — mirrors backend app/schemas/auth.py

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

/** Returned by POST /auth/register and POST /auth/login */
export interface TokenResponse {
  user_id: string;
  nickname: string;
  access_token: string;
  refresh_token: string;
  requires_assessment: boolean;
}

/** Returned by POST /auth/refresh */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

/** Returned by GET /auth/me — field names kept as-is (snake_case from backend) */
export interface UserMe {
  user_id: string;
  nickname: string;
  email: string;
  requires_assessment: boolean;
}
