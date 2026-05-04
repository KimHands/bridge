# Bridge — API 명세서

> 작성일: 2026-04-13
> 버전: v1.0
> Base URL: `https://api.bridge.app/v1`
> 인증 방식: JWT Bearer Token

---

## 목차

1. [공통 규칙](#1-공통-규칙)
2. [인증 Auth](#2-인증-auth)
3. [자가평가 Assessment](#3-자가평가-assessment)
4. [일기 Diary](#4-일기-diary)
5. [키워드 Keywords](#5-키워드-keywords)
6. [루틴 Routines](#6-루틴-routines)
7. [트리거 Trigger](#7-트리거-trigger)
8. [리포트 Report](#8-리포트-report)
9. [미션 포인트 Mission](#9-미션-포인트-mission)
10. [사용자 Users](#10-사용자-users)
11. [에러 코드](#11-에러-코드)

---

## 1. 공통 규칙

### 1.1 요청 헤더

```
Content-Type: application/json
Authorization: Bearer {access_token}  // 인증 필요 엔드포인트만
```

### 1.2 공통 응답 구조

**성공**
```json
{
  "success": true,
  "data": { ... },
  "message": "ok"
}
```

**실패**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 설명"
  }
}
```

### 1.3 페이지네이션

리스트 응답은 커서 기반 페이지네이션 사용.

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "cursor": "2026-04-01T00:00:00Z",
    "has_next": true
  }
}
```

### 1.4 날짜 형식

모든 날짜/시간은 ISO 8601 형식 사용. `2026-04-13T09:00:00Z`

---

## 2. 인증 Auth

### 2.1 회원가입

```
POST /auth/register
인증: 불필요
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "종건"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "nickname": "종건",
    "access_token": "jwt_token",
    "refresh_token": "jwt_refresh_token",
    "requires_assessment": true
  }
}
```

| 필드 | 설명 |
|------|------|
| `requires_assessment` | `true` 시 클라이언트는 자가평가 화면으로 이동 |

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `EMAIL_ALREADY_EXISTS` | 이미 가입된 이메일 |
| `INVALID_PASSWORD_FORMAT` | 비밀번호 형식 불일치 |
| `MISSING_REQUIRED_FIELD` | 필수 필드 누락 |

---

### 2.2 로그인

```
POST /auth/login
인증: 불필요
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "nickname": "종건",
    "access_token": "jwt_token",
    "refresh_token": "jwt_refresh_token",
    "requires_assessment": false
  }
}
```

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `INVALID_CREDENTIALS` | 이메일 또는 비밀번호 불일치 |
| `USER_NOT_FOUND` | 미가입 이메일 |

---

### 2.3 토큰 갱신

```
POST /auth/refresh
인증: 불필요
```

**Request Body**
```json
{
  "refresh_token": "jwt_refresh_token"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "new_jwt_token",
    "refresh_token": "new_jwt_refresh_token"
  }
}
```

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `INVALID_REFRESH_TOKEN` | 만료되거나 유효하지 않은 토큰 |

---

### 2.4 로그아웃

```
POST /auth/logout
인증: 필요
```

**Request Body**
```json
{
  "refresh_token": "jwt_refresh_token"
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "로그아웃 완료"
}
```

> Redis JWT 블랙리스트에 토큰 등록하여 세션 무효화.

---

## 3. 자가평가 Assessment

### 3.1 자가평가 제출

```
POST /assessments
인증: 필요
```

**Request Body**
```json
{
  "phq9_answers": [1, 2, 0, 1, 0, 2, 1, 0, 0],
  "primary_cause": "sleep",
  "secondary_cause": "academic"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `phq9_answers` | int[] | PHQ-9 9개 문항 응답 (0~3), 순서 고정 |
| `primary_cause` | string | 주원인 코드 |
| `secondary_cause` | string | 부원인 코드 (nullable) |

**주원인 코드**

| 코드 | 의미 |
|------|------|
| `sleep` | 수면 문제 |
| `academic` | 학업·업무 |
| `future` | 진로·미래 |
| `financial` | 경제적 걱정 |
| `relationship` | 대인관계 |
| `physical` | 신체 건강 |
| `unknown` | 모르겠음 |

**Response 201**
```json
{
  "success": true,
  "data": {
    "assessment_id": "uuid",
    "phq9_score": 7,
    "phq9_level": 2,
    "primary_cause": "sleep",
    "secondary_cause": "academic",
    "assigned_routines": [
      {
        "routine_id": "uuid",
        "title": "취침 전 4-7-8 호흡 5분",
        "category": "sleep"
      },
      {
        "routine_id": "uuid",
        "title": "감정 일기 작성",
        "category": "diary"
      }
    ]
  }
}
```

| 필드 | 설명 |
|------|------|
| `phq9_level` | 1~4 구간 (1:정상, 2:경증, 3:중등도, 4:중증) |
| `assigned_routines` | 초기 배정된 루틴 목록 |

> `phq9_answers[8]` (9번 문항) ≥ 1 이면 서버에서 플래그 저장. 클라이언트는 별도 안내 팝업 표시.

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `INVALID_PHQ9_ANSWERS` | 응답 배열 길이가 9가 아니거나 범위 초과 |
| `INVALID_CAUSE_CODE` | 유효하지 않은 원인 코드 |

---

### 3.2 자가평가 이력 조회

```
GET /assessments
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "assessment_id": "uuid",
        "phq9_score": 7,
        "phq9_level": 2,
        "primary_cause": "sleep",
        "taken_at": "2026-04-01T10:00:00Z"
      }
    ]
  }
}
```

---

## 4. 일기 Diary

### 4.1 일기 작성

```
POST /diaries
인증: 필요
```

**Request Body**
```json
{
  "mood_score": 2,
  "emotion_keywords": ["불안한", "외로운"],
  "situation_keywords": [
    {
      "emotion_keyword": "불안한",
      "answer": "미래나 진로가 불확실해요"
    },
    {
      "emotion_keyword": "외로운",
      "answer": "혼자 있는 시간이 너무 길었어요"
    }
  ],
  "memo": "오늘 유독 힘든 하루였다."
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `mood_score` | int | 1~5 |
| `emotion_keywords` | string[] | 최대 2개 |
| `situation_keywords` | object[] | 감정 키워드별 상황 답변 |
| `memo` | string | 선택 사항, 최대 200자, AES-256-GCM 암호화 저장 |

**Response 201**
```json
{
  "success": true,
  "data": {
    "diary_id": "uuid",
    "mood_score": 2,
    "emotion_keywords": ["불안한", "외로운"],
    "situation_keywords": [
      {
        "emotion_keyword": "불안한",
        "answer": "미래나 진로가 불확실해요"
      }
    ],
    "created_at": "2026-04-13T21:00:00Z",
    "trigger_executed": true
  }
}
```

| 필드 | 설명 |
|------|------|
| `trigger_executed` | 트리거 알고리즘 실행 여부 |

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `DIARY_ALREADY_EXISTS_TODAY` | 오늘 이미 작성된 일기 존재 |
| `INVALID_MOOD_SCORE` | mood_score 범위 초과 |
| `TOO_MANY_EMOTION_KEYWORDS` | emotion_keywords 3개 이상 |
| `MEMO_TOO_LONG` | memo 200자 초과 |

---

### 4.2 일기 수정

```
PATCH /diaries/{diary_id}
인증: 필요
```

> 당일 작성 일기만 수정 가능. 당일 자정 이후 수정 불가.

**Request Body**
```json
{
  "mood_score": 3,
  "emotion_keywords": ["평온한"],
  "situation_keywords": [
    {
      "emotion_keyword": "평온한",
      "answer": "좋아하는 걸 하며 보냈어요"
    }
  ],
  "memo": "저녁에 산책하고 나서 좀 나아졌다."
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "diary_id": "uuid",
    "updated_at": "2026-04-13T22:00:00Z"
  }
}
```

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `DIARY_NOT_FOUND` | 존재하지 않는 일기 |
| `DIARY_NOT_EDITABLE` | 당일 작성분이 아닌 경우 |
| `UNAUTHORIZED` | 본인 일기가 아닌 경우 |

---

### 4.3 일기 목록 조회

```
GET /diaries?cursor={cursor}&limit={limit}
인증: 필요
```

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `cursor` | string | 없음 | 이전 응답의 cursor 값 |
| `limit` | int | 20 | 최대 50 |

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "diary_id": "uuid",
        "mood_score": 2,
        "emotion_keywords": ["불안한"],
        "memo_preview": "오늘 유독 힘든...",
        "created_at": "2026-04-13T21:00:00Z"
      }
    ],
    "cursor": "2026-04-12T21:00:00Z",
    "has_next": true
  }
}
```

---

### 4.4 일기 상세 조회

```
GET /diaries/{diary_id}
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "diary_id": "uuid",
    "mood_score": 2,
    "emotion_keywords": ["불안한", "외로운"],
    "situation_keywords": [
      {
        "emotion_keyword": "불안한",
        "answer": "미래나 진로가 불확실해요"
      },
      {
        "emotion_keyword": "외로운",
        "answer": "혼자 있는 시간이 너무 길었어요"
      }
    ],
    "memo": "오늘 유독 힘든 하루였다.",
    "created_at": "2026-04-13T21:00:00Z"
  }
}
```

---

### 4.5 오늘 일기 작성 여부 확인

```
GET /diaries/today/status
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "has_diary_today": true,
    "diary_id": "uuid",
    "mood_score": 2
  }
}
```

---

## 5. 키워드 Keywords

### 5.1 감정 키워드 목록 조회

```
GET /keywords/emotions
인증: 불필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "keywords": [
      {
        "name": "우울한",
        "category": "negative",
        "question": "지금 가장 힘든 게 뭔가요?",
        "answers": [
          "아무것도 하기 싫고 의욕이 없어요",
          "나 자신이 쓸모없다는 느낌이 들어요",
          "미래가 막막하고 희망이 없어요",
          "이유를 모르겠어요"
        ]
      }
    ],
    "highlights_by_mood": {
      "1": ["우울한", "무기력한"],
      "2": ["불안한", "외로운"],
      "3": ["초조한", "짜증나는"],
      "4": ["평온한", "뿌듯한"],
      "5": ["뿌듯한", "평온한"]
    }
  }
}
```

---

## 6. 루틴 Routines

### 6.1 내 루틴 목록 조회

```
GET /routines/me
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "routines": [
      {
        "user_routine_id": "uuid",
        "routine_id": "uuid",
        "title": "취침 전 4-7-8 호흡 5분",
        "category": "sleep",
        "difficulty_level": 1,
        "source": "initial",
        "is_completed_today": false,
        "assigned_at": "2026-04-01T10:00:00Z"
      }
    ]
  }
}
```

| 필드 | 설명 |
|------|------|
| `source` | `initial` / `trigger` / `manual` |
| `is_completed_today` | 오늘 완료 여부 |

---

### 6.2 루틴 완료 처리

```
PATCH /routines/{user_routine_id}/complete
인증: 필요
```

**Request Body**
```json
{
  "completed": true
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "user_routine_id": "uuid",
    "completed": true,
    "logged_at": "2026-04-13T08:30:00Z"
  }
}
```

---

### 6.3 루틴 추가

```
POST /routines/me
인증: 필요
```

**Request Body**
```json
{
  "routine_id": "uuid"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "user_routine_id": "uuid",
    "routine_id": "uuid",
    "title": "하루 10분 산책",
    "source": "manual",
    "assigned_at": "2026-04-13T10:00:00Z"
  }
}
```

**에러 케이스**

| 코드 | 상황 |
|------|------|
| `ROUTINE_ALREADY_ASSIGNED` | 이미 추가된 루틴 |
| `ROUTINE_NOT_FOUND` | 존재하지 않는 루틴 |

---

### 6.4 루틴 삭제

```
DELETE /routines/{user_routine_id}
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "루틴이 삭제되었습니다."
}
```

---

### 6.5 루틴 라이브러리 조회

```
GET /routines/library?category={category}
인증: 필요
```

**Query Parameters**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `category` | string | 선택 필터 (sleep / physical / mind / productivity / reading) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "routines": [
      {
        "routine_id": "uuid",
        "title": "취침 전 4-7-8 호흡 5분",
        "category": "sleep",
        "difficulty_level": 1,
        "description": "4초 들이쉬고, 7초 참고, 8초 내쉬는 호흡법"
      }
    ]
  }
}
```

---

### 6.6 루틴 순서 변경

```
PATCH /routines/me/order
인증: 필요
```

**Request Body**
```json
{
  "ordered_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "순서가 변경되었습니다."
}
```

---

## 7. 트리거 Trigger

### 7.1 트리거 실행 (내부 호출)

> 일기 저장(`POST /diaries`) 시 서버 내부에서 자동 호출. 클라이언트 직접 호출 불필요.

```
POST /trigger/evaluate  (internal)
```

**처리 흐름**
1. 최근 7일 일기 데이터 조회
2. 감정 키워드 빈도 집계
3. 트리거 점수 산출 (mood_score 30% + 키워드 70%)
4. 3회 이상 등장 키워드 체크
5. 쿨다운 3일 체크
6. 조건 충족 시 복합/단일 루틴 추천 → `user_routines` 갱신
7. `trigger_logs` 기록

---

### 7.2 트리거 이력 조회

```
GET /trigger/logs
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "trigger_id": "uuid",
        "triggered_keyword": "불안한",
        "trigger_score": 0.72,
        "new_routine_title": "5분 마음 챙김 호흡",
        "triggered_at": "2026-04-10T22:00:00Z",
        "cooldown_until": "2026-04-13T22:00:00Z"
      }
    ]
  }
}
```

---

## 8. 리포트 Report

### 8.1 주간 리포트 조회

```
GET /reports/weekly?date={YYYY-MM-DD}
인증: 필요
```

**Query Parameters**

| 파라미터 | 설명 |
|---------|------|
| `date` | 기준 날짜 (해당 날짜가 속한 주의 리포트 반환). 생략 시 이번 주 |

**Response 200**
```json
{
  "success": true,
  "data": {
    "week_start": "2026-04-07",
    "week_end": "2026-04-13",
    "routine_completion_rate": 71.4,
    "mood_average": 2.8,
    "mood_scores": [2, 3, 2, 4, 3, 2, 3],
    "top_emotion_keywords": ["불안한", "외로운", "평온한"],
    "top_situation_keywords": [
      "미래나 진로가 불확실해요",
      "혼자 있는 시간이 너무 길었어요"
    ],
    "diary_count": 5
  }
}
```

---

### 8.2 월간 리포트 조회

```
GET /reports/monthly?year={YYYY}&month={MM}
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 4,
    "routine_completion_rate": 65.0,
    "mood_average": 2.9,
    "mood_trend": [
      { "date": "2026-04-01", "mood_score": 2 },
      { "date": "2026-04-02", "mood_score": 3 }
    ],
    "emotion_keyword_distribution": {
      "불안한": 8,
      "외로운": 5,
      "평온한": 4,
      "무기력한": 3
    },
    "diary_count": 18
  }
}
```

---

### 8.3 감정 추이 조회

```
GET /reports/mood-trend?from={YYYY-MM-DD}&to={YYYY-MM-DD}
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "trend": [
      { "date": "2026-04-07", "mood_score": 2 },
      { "date": "2026-04-08", "mood_score": 3 },
      { "date": "2026-04-09", "mood_score": 2 }
    ]
  }
}
```

---

## 9. 미션 포인트 Mission

### 9.1 이번 주 미션 점수 조회

```
GET /missions/weekly
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "week_year": "2026-W15",
    "routine_days": 4,
    "diary_days": 3,
    "weekly_score": 57,
    "total_score": 312,
    "is_achieved": true
  }
}
```

| 필드 | 설명 |
|------|------|
| `weekly_score` | 루틴 달성 70% + 일기 30% 기준 주간 점수 |
| `total_score` | 누적 총점 |
| `is_achieved` | 이번 주 달성 여부 (3일 이상 충족 시 true) |

---

### 9.2 총 누적 점수 조회

```
GET /missions/total
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "total_score": 312,
    "weekly_history": [
      {
        "week_year": "2026-W14",
        "weekly_score": 85,
        "is_achieved": true
      },
      {
        "week_year": "2026-W15",
        "weekly_score": 57,
        "is_achieved": true
      }
    ]
  }
}
```

---

## 10. 사용자 Users

### 10.1 내 정보 조회

```
GET /users/me
인증: 필요
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "nickname": "종건",
    "created_at": "2026-04-01T10:00:00Z",
    "last_assessment_at": "2026-04-01T10:05:00Z",
    "phq9_level": 2
  }
}
```

---

### 10.2 닉네임 수정

```
PATCH /users/me
인증: 필요
```

**Request Body**
```json
{
  "nickname": "새닉네임"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "nickname": "새닉네임"
  }
}
```

---

### 10.3 회원 탈퇴

```
DELETE /users/me
인증: 필요
```

**Request Body**
```json
{
  "password": "password123",
  "reason": "앱이 불편해요"
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "탈퇴가 완료되었습니다. 7일 이내 모든 데이터가 삭제됩니다."
}
```

> 탈퇴 처리 후 7일 이내 모든 개인정보 및 일기 데이터 파기 (개인정보보호법 대응).

---

## 11. 에러 코드

### 11.1 HTTP 상태 코드

| 상태 코드 | 의미 |
|---------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (파라미터 오류) |
| 401 | 인증 실패 (토큰 없음 또는 만료) |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 생성 등) |
| 422 | 유효성 검사 실패 |
| 500 | 서버 내부 오류 |

### 11.2 에러 코드 목록

| 에러 코드 | HTTP | 설명 |
|---------|------|------|
| `EMAIL_ALREADY_EXISTS` | 409 | 이미 가입된 이메일 |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호 불일치 |
| `INVALID_REFRESH_TOKEN` | 401 | 유효하지 않은 Refresh Token |
| `USER_NOT_FOUND` | 404 | 존재하지 않는 사용자 |
| `INVALID_PASSWORD_FORMAT` | 400 | 비밀번호 형식 불일치 |
| `MISSING_REQUIRED_FIELD` | 400 | 필수 필드 누락 |
| `INVALID_PHQ9_ANSWERS` | 422 | PHQ-9 응답 배열 오류 |
| `INVALID_CAUSE_CODE` | 422 | 유효하지 않은 원인 코드 |
| `DIARY_ALREADY_EXISTS_TODAY` | 409 | 오늘 일기 중복 작성 |
| `DIARY_NOT_FOUND` | 404 | 존재하지 않는 일기 |
| `DIARY_NOT_EDITABLE` | 403 | 수정 불가 일기 (당일 아님) |
| `INVALID_MOOD_SCORE` | 400 | mood_score 범위 초과 |
| `TOO_MANY_EMOTION_KEYWORDS` | 400 | 감정 키워드 3개 이상 |
| `MEMO_TOO_LONG` | 400 | 메모 200자 초과 |
| `ROUTINE_ALREADY_ASSIGNED` | 409 | 이미 추가된 루틴 |
| `ROUTINE_NOT_FOUND` | 404 | 존재하지 않는 루틴 |
| `UNAUTHORIZED` | 401 | 인증 토큰 없음 또는 만료 |
| `FORBIDDEN` | 403 | 접근 권한 없음 |
| `INTERNAL_SERVER_ERROR` | 500 | 서버 내부 오류 |
