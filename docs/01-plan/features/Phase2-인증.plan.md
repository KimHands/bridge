# [Plan] Phase 2 — Auth Service (인증 서비스)

> 작성일: 2026-04-13
> Phase: 2 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

Bridge의 사용자 인증 흐름 전체를 구현한다.  
이 Phase가 완료되면 회원가입·로그인·토큰 갱신·로그아웃 4개 엔드포인트가 동작하고,  
JWT Access Token 기반 인증 미들웨어가 이후 모든 Phase에서 재사용 가능한 상태가 된다.

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 항목 | 설명 |
|---|------|------|
| 1 | POST /auth/register | 회원가입: 이메일·비밀번호·닉네임, bcrypt 해시, email_hash 저장 |
| 2 | POST /auth/login | 로그인: bcrypt 검증 → JWT 발급 → Redis 세션 저장 |
| 3 | POST /auth/refresh | 토큰 갱신: Refresh Token Rotation 패턴 |
| 4 | POST /auth/logout | 로그아웃: Refresh Token Redis 블랙리스트 등록 |
| 5 | JWT 인증 미들웨어 | Access Token 검증 + Redis 블랙리스트 확인 (의존성 주입) |
| 6 | Pydantic 요청/응답 스키마 | 입력 유효성 검사 포함 |

### 제외 (Out of Scope)

- 자가평가·일기·루틴 등 비즈니스 로직 (Phase 3~8)
- 소셜 로그인 (OAuth)
- 이메일 인증 발송
- 비밀번호 찾기/재설정

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 회원가입 (POST /auth/register)

- 요청: `email`, `password`, `nickname`
- 이메일 중복 체크: `email_hash` (SHA-256) 기준으로 조회
- 비밀번호 형식: 최소 8자 이상 (추가 정책은 API 명세서 기준)
- bcrypt(cost factor 12)로 비밀번호 단방향 해시
- 가입 즉시 Access Token + Refresh Token 발급
- 응답에 `requires_assessment: true` 포함 (자가평가 미완료 상태)
- 에러: `EMAIL_ALREADY_EXISTS`, `INVALID_PASSWORD_FORMAT`, `MISSING_REQUIRED_FIELD`

### 3.2 로그인 (POST /auth/login)

- 요청: `email`, `password`
- `email_hash`로 사용자 조회 후 bcrypt 검증
- 검증 성공 시 Access Token(1h) + Refresh Token(14d) 발급
- Redis에 Refresh Token 저장 (key: `session:{user_id}`, TTL 14일)
- 응답에 `requires_assessment` 포함 (자가평가 완료 여부)
- 에러: `INVALID_CREDENTIALS`, `USER_NOT_FOUND`

### 3.3 토큰 갱신 (POST /auth/refresh)

- 요청: `refresh_token`
- Redis 블랙리스트 확인 → 서명 검증 → 새 토큰 쌍 발급
- **Refresh Token Rotation**: 이전 Refresh Token 즉시 블랙리스트 등록
- 새 Refresh Token Redis 세션 갱신 (TTL 14일 리셋)
- 에러: `INVALID_REFRESH_TOKEN`

### 3.4 로그아웃 (POST /auth/logout)

- 요청: `refresh_token` (Authorization 헤더 Access Token 필요)
- Redis 블랙리스트에 Refresh Token 등록 (key: `blacklist:{jti}`, TTL = 잔여 만료 시간)
- Redis에서 세션 키 삭제
- 에러: 없음 (이미 로그아웃된 토큰도 성공 처리)

### 3.5 JWT 인증 미들웨어

- `get_current_user` 의존성 함수 — FastAPI Depends()로 주입
- Authorization 헤더에서 Bearer 토큰 추출
- 토큰 서명 검증 (HS256, SECRET_KEY)
- Redis 블랙리스트 조회 (Access Token `jti`)
- 사용자 DB 조회 후 User 객체 반환
- 에러: 401 `TOKEN_EXPIRED`, `INVALID_TOKEN`, `TOKEN_BLACKLISTED`

---

## 4. 보안 요구사항

| 요구사항 | 상세 |
|---------|------|
| 비밀번호 | bcrypt, cost factor 12. 평문 저장 절대 금지 |
| 이메일 | SHA-256 해시만 저장 (`email_hash`). 원문 DB 저장 금지 |
| JWT 서명 | HS256 알고리즘, SECRET_KEY 환경 변수로 관리 |
| Redis TTL | Refresh Token 세션 14일, 블랙리스트 TTL = 토큰 잔여 만료 시간 |
| HTTPS | TLS 1.3 전용 (로컬 개발에서는 HTTP 허용) |
| 토큰 탈취 대응 | Refresh Token Rotation으로 재사용 불가 |

---

## 5. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | `POST /auth/register` 201 응답, DB에 사용자 저장, 토큰 반환 |
| ☐ | `POST /auth/login` 200 응답, bcrypt 검증 통과, 토큰 반환 |
| ☐ | `POST /auth/refresh` 200 응답, 이전 Refresh Token 블랙리스트 등록 확인 |
| ☐ | `POST /auth/logout` 200 응답, Refresh Token 블랙리스트 등록 후 재사용 불가 |
| ☐ | 인증 미들웨어: 유효 토큰 → 정상, 만료/블랙리스트 → 401 |
| ☐ | 중복 이메일 가입 → 409 `EMAIL_ALREADY_EXISTS` |
| ☐ | 잘못된 비밀번호 로그인 → 401 `INVALID_CREDENTIALS` |
| ☐ | `localhost:8000/docs` Swagger에서 4개 엔드포인트 직접 테스트 가능 |

---

## 6. 구현 순서 (Implementation Order)

```
1. app/schemas/auth.py         — Pydantic 요청/응답 스키마 정의
2. app/core/security.py        — bcrypt 해시/검증, JWT 생성/검증, email_hash 유틸
3. app/core/redis.py           — Redis 클라이언트 (aioredis), 세션/블랙리스트 함수
4. app/api/v1/auth.py          — 4개 엔드포인트 라우터
5. app/dependencies/auth.py    — get_current_user 의존성 함수
6. app/main.py                 — /v1/auth 라우터 등록
7. 완료 기준 검증 (Swagger UI + curl)
```

---

## 7. 새로운 디렉토리/파일 목록

```
backend/app/
├── schemas/
│   └── auth.py                # RegisterRequest, LoginRequest, TokenResponse 등
├── core/
│   ├── security.py            # 비밀번호 해시, JWT, email_hash
│   └── redis.py               # Redis 클라이언트 + 세션/블랙리스트 헬퍼
├── api/
│   └── v1/
│       ├── __init__.py
│       └── auth.py            # APIRouter: register, login, refresh, logout
└── dependencies/
    └── auth.py                # get_current_user
```

---

## 8. 의존성

```
# requirements.txt (Phase 1에서 이미 추가됨)
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
redis[hiredis]==5.0.4
```

추가 패키지 없음 — Phase 1에서 설치한 패키지로 전부 구현 가능.

---

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| bcrypt 해시 비용으로 로그인 응답 지연 | cost factor 12는 ~200ms, 허용 범위. 필요 시 12→10 조정 |
| Redis 연결 실패 시 로그아웃 불가 | 로그아웃은 Redis 실패 시에도 200 반환, 별도 로그 기록 |
| JWT 서명 키 유출 | `.env`에만 관리, `.gitignore` 필수 확인 |
| Refresh Token Rotation 중복 요청 | 동시 요청 시 레이스컨디션 가능 — Redis SETNX/Lua 스크립트로 원자적 처리 |

---

## 참고 문서

- `docs/Bridge_API_명세서.md` — 2. 인증 Auth 섹션
- `docs/Bridge_시퀀스다이어그램.md` — 1. 로그인 흐름, 3. JWT 토큰 갱신
- `CLAUDE.md` — 보안 필수 규칙, 기술 스택
