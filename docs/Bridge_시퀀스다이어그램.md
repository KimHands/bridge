# Bridge — 시퀀스 다이어그램

> 작성일: 2026-04-13
> 버전: v1.0

---

## 목차

1. [로그인 흐름](#1-로그인-흐름)
2. [일기 저장 + 트리거 알고리즘 실행](#2-일기-저장--트리거-알고리즘-실행)
3. [JWT 토큰 갱신](#3-jwt-토큰-갱신)

---

## 1. 로그인 흐름

### 참여자

| 참여자 | 역할 |
|--------|------|
| 클라이언트 | React Native 앱 |
| API 게이트웨이 | 요청 라우팅 · CORS · Rate Limiting |
| Auth Service | 인증 · JWT 발급 |
| Redis | 세션 저장 · JWT 블랙리스트 |
| PostgreSQL | 사용자 정보 저장 |

### 흐름

```
클라이언트          게이트웨이        Auth Service      Redis       PostgreSQL
    │                   │                  │               │              │
    │ POST /auth/login  │                  │               │              │
    │ (email, password) │                  │               │              │
    │──────────────────>│                  │               │              │
    │                   │  요청 라우팅     │               │              │
    │                   │─────────────────>│               │              │
    │                   │                  │  사용자 조회  │              │
    │                   │                  │──────────────────────────────>
    │                   │                  │  사용자 레코드 반환          │
    │                   │                  │<──────────────────────────────
    │                   │                  │               │              │
    │                   │                  │ [bcrypt 비밀번호 검증]       │
    │                   │                  │ [Access Token + Refresh Token 생성]
    │                   │                  │               │              │
    │                   │                  │ 세션 저장     │              │
    │                   │                  │ (TTL 14일)    │              │
    │                   │                  │──────────────>│              │
    │                   │                  │               │              │
    │                   │  200 OK          │               │              │
    │                   │  {access_token,  │               │              │
    │                   │   refresh_token} │               │              │
    │                   │<─────────────────│               │              │
    │  200 OK + 토큰    │                  │               │              │
    │<──────────────────│                  │               │              │
```

### 단계별 설명

| 단계 | 설명 |
|------|------|
| 1 | 클라이언트가 이메일·비밀번호를 API 게이트웨이로 전송 |
| 2 | 게이트웨이가 Auth Service로 요청 라우팅 |
| 3 | Auth Service가 PostgreSQL에서 이메일 해시로 사용자 조회 |
| 4 | bcrypt(cost factor 12)로 비밀번호 검증 |
| 5 | Access Token(1시간) + Refresh Token(14일) JWT 생성 |
| 6 | Redis에 세션 저장 (TTL 14일) |
| 7 | 클라이언트에 토큰 반환 |

### 에러 케이스

| 조건 | 응답 |
|------|------|
| 사용자 없음 | 401 `USER_NOT_FOUND` |
| 비밀번호 불일치 | 401 `INVALID_CREDENTIALS` |
| Redis 세션 저장 실패 | 토큰 발급은 유지, 로그 기록 |

---

## 2. 일기 저장 + 트리거 알고리즘 실행

### 참여자

| 참여자 | 역할 |
|--------|------|
| 클라이언트 | React Native 앱 |
| API 게이트웨이 | JWT 검증 · 라우팅 |
| Encryption Service | AES-256-GCM 암호화 |
| PostgreSQL | 데이터 저장 |
| Trigger Worker | 루틴 트리거 알고리즘 (Python) |

### 흐름

```
클라이언트       게이트웨이     Encryption     PostgreSQL    Trigger Worker
    │                │           Service          │                │
    │ POST /diaries  │               │            │                │
    │ (mood, keywords│               │            │                │
    │  memo) + JWT   │               │            │                │
    │───────────────>│               │            │                │
    │                │ JWT 유효성 검사            │                │
    │                │ + Redis 블랙리스트 확인    │                │
    │                │               │            │                │
    │                │ 메모 암호화 요청            │                │
    │                │──────────────>│            │                │
    │                │ 암호화된 메모  │            │                │
    │                │<──────────────│            │                │
    │                │               │            │                │
    │                │ INSERT diary_entries       │                │
    │                │ + emotion_keywords         │                │
    │                │────────────────────────────>               │
    │                │               │  저장 완료  │               │
    │                │<────────────────────────────               │
    │  201 Created   │               │            │                │
    │  {diary_id}    │               │            │                │
    │<───────────────│               │            │                │
    │                │                        (비동기 이벤트 발행) │
    │                │────────────────────────────────────────────>
    │                │               │            │                │
    │                │               │            │  최근 7일 일기 조회
    │                │               │            │<───────────────│
    │                │               │            │  일기 목록 반환 │
    │                │               │            │───────────────>│
    │                │               │            │                │
    │                │               │            │ [트리거 점수 산출]
    │                │               │            │ mood 30% + 키워드 70%
    │                │               │            │ [3회 이상 + 쿨다운 체크]
    │                │               │            │                │
    │                │               │            │ UPDATE user_routines
    │                │               │            │<───────────────│
    │                │               │            │ INSERT trigger_logs
    │                │               │            │<───────────────│
```

### 핵심 설계 포인트

**비동기 처리 (→ vs ─))**
클라이언트에게 `201 Created`를 먼저 응답한 뒤, 트리거 워커를 비동기로 실행해요. 사용자가 트리거 알고리즘 실행을 기다리지 않아도 돼요.

**암호화 흐름**
```
메모(평문) → Encryption Service → AES-256-GCM 암호화 → {IV}:{암호문} → PostgreSQL 저장
```

**트리거 알고리즘 실행 조건**
```python
# 7일 관찰, 3회 이상 등장 키워드가 있을 때
triggered = [k for k, v in freq.items() if v >= 3]

# 트리거 점수 = mood 30% + 키워드 빈도 70%
score = (5 - mood_avg) / 5 * 0.3 + keyword_weight * 0.7

# 쿨다운 3일 체크 (Redis)
cooldown_until = trigger_log.triggered_at + timedelta(days=3)
```

### 단계별 설명

| 단계 | 설명 |
|------|------|
| 1 | 클라이언트가 mood_score, emotion_keywords, memo, JWT 전송 |
| 2 | 게이트웨이에서 JWT 유효성 검사 + Redis 블랙리스트 확인 |
| 3 | Encryption Service에서 메모 AES-256-GCM 암호화 |
| 4 | PostgreSQL에 일기 데이터 저장 |
| 5 | 클라이언트에 `201 Created` 즉시 응답 |
| 6 | 트리거 워커에 비동기 이벤트 발행 |
| 7 | 워커가 최근 7일 일기 데이터 조회 |
| 8 | 트리거 점수 산출 및 조건 체크 |
| 9 | 조건 충족 시 `user_routines` 갱신 + `trigger_logs` 기록 |

### 에러 케이스

| 조건 | 처리 |
|------|------|
| JWT 만료 | 401 → 클라이언트가 토큰 갱신 후 재시도 |
| 암호화 서비스 장애 | 메모 없이 일기 저장 계속 진행 (메모는 null 처리) |
| 트리거 워커 실패 | 일기 저장에는 영향 없음. 실패 로그 기록 후 재시도 |
| 오늘 일기 중복 | 409 `DIARY_ALREADY_EXISTS_TODAY` |

---

## 3. JWT 토큰 갱신

### 참여자

| 참여자 | 역할 |
|--------|------|
| 클라이언트 | React Native 앱 |
| API 게이트웨이 | 요청 라우팅 |
| Auth Service | 토큰 검증 · 재발급 |
| Redis | 블랙리스트 확인 · 세션 갱신 |

### 흐름

```
클라이언트          게이트웨이        Auth Service         Redis
    │                   │                  │                  │
    │ [Access Token 만료 감지 (401)]       │                  │
    │                   │                  │                  │
    │ POST /auth/refresh │                 │                  │
    │ (refresh_token)   │                  │                  │
    │──────────────────>│                  │                  │
    │                   │  요청 라우팅     │                  │
    │                   │─────────────────>│                  │
    │                   │                  │ 블랙리스트 확인  │
    │                   │                  │─────────────────>│
    │                   │                  │ 블랙리스트 없음  │
    │                   │                  │<─────────────────│
    │                   │                  │                  │
    │                   │                  │ [Refresh Token 서명 검증]
    │                   │                  │ [새 Access Token + Refresh Token 생성]
    │                   │                  │                  │
    │                   │                  │ 이전 Refresh Token 블랙리스트 등록
    │                   │                  │─────────────────>│
    │                   │                  │ 새 세션 저장     │
    │                   │                  │ (TTL 14일)       │
    │                   │                  │─────────────────>│
    │                   │                  │ 저장 완료        │
    │                   │                  │<─────────────────│
    │                   │  200 OK          │                  │
    │                   │  {new_access,    │                  │
    │                   │   new_refresh}   │                  │
    │                   │<─────────────────│                  │
    │  200 OK + 새 토큰 │                  │                  │
    │<──────────────────│                  │                  │
    │                   │                  │                  │
    │ [새 토큰 저장 후 원래 요청 재시도]   │                  │
```

### 핵심 설계 포인트

**Refresh Token Rotation 패턴**

토큰 갱신 시 이전 Refresh Token을 즉시 블랙리스트에 등록하고 새 토큰 쌍을 발급해요. 탈취된 Refresh Token의 재사용을 방지하는 보안 패턴이에요.

```
기존 Refresh Token → Redis 블랙리스트 등록 (즉시 무효화)
새 Access Token    → 클라이언트 반환 (TTL 1시간)
새 Refresh Token   → Redis 세션 저장 (TTL 14일) + 클라이언트 반환
```

**클라이언트 자동 갱신 로직**

```javascript
// React Query interceptor 예시
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newTokens = await refreshToken();
      error.config.headers.Authorization = `Bearer ${newTokens.access_token}`;
      return axiosInstance(error.config); // 원래 요청 재시도
    }
    return Promise.reject(error);
  }
);
```

### 단계별 설명

| 단계 | 설명 |
|------|------|
| 1 | API 응답 401 수신 시 클라이언트가 자동으로 토큰 갱신 시도 |
| 2 | 현재 Refresh Token을 게이트웨이로 전송 |
| 3 | Auth Service가 Redis에서 블랙리스트 확인 |
| 4 | Refresh Token 서명 및 만료 여부 검증 |
| 5 | 새 Access Token + Refresh Token 생성 |
| 6 | 이전 Refresh Token 즉시 블랙리스트 등록 (Rotation) |
| 7 | 새 Refresh Token Redis에 저장 |
| 8 | 클라이언트에 새 토큰 반환 후 원래 요청 재시도 |

### 에러 케이스

| 조건 | 처리 |
|------|------|
| Refresh Token 블랙리스트 등록됨 | 401 `INVALID_REFRESH_TOKEN` → 로그아웃 처리 |
| Refresh Token 만료 | 401 → 로그아웃 처리, 로그인 화면으로 이동 |
| Refresh Token 서명 불일치 | 401 → 보안 이상 감지, 강제 로그아웃 |

---

## 정리 — 주요 설계 결정

| 결정 사항 | 선택 | 이유 |
|---------|------|------|
| 트리거 실행 방식 | 비동기 (이벤트 발행) | 일기 저장 응답 지연 방지 |
| Refresh Token 방식 | Rotation 패턴 | 탈취 토큰 재사용 방지 |
| 메모 암호화 시점 | 게이트웨이 → 저장 전 | DB에 평문 미저장 |
| JWT 블랙리스트 저장소 | Redis | 빠른 조회 속도, TTL 자동 관리 |
| Access Token 유효 기간 | 1시간 | 보안과 UX 균형 |
| Refresh Token 유효 기간 | 14일 | 재로그인 최소화 |
