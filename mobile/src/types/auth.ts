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

/** POST /auth/anonymous — device_secret 기반 익명 부트스트랩 */
export interface AnonymousRequest {
  device_secret: string;
  nickname?: string;
}

/** POST /auth/upgrade — 익명 계정을 이메일·비밀번호 계정으로 승격 */
export interface UpgradeRequest {
  email: string;
  password: string;
}

/** POST /auth/upgrade, /auth/verify-email, /auth/resend-verification 공통 응답 */
export interface EmailVerificationStatus {
  email_verified: boolean;
}

/** POST /auth/verify-email */
export interface VerifyEmailRequest {
  code: string;
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
