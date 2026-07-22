# Bridge — 시스템 아키텍처

> 작성일: 2026-04-13
> 버전: v1.0

---

## 전체 구조 개요

```
┌─────────────────────────────────────────────┐
│              클라이언트 레이어                │
│         React Native (Expo)                 │
│    iOS · Android · Zustand · React Query    │
└──────────────────────┬──────────────────────┘
                       │ HTTPS / TLS 1.3
┌──────────────────────▼──────────────────────┐
│              API 게이트웨이                   │
│   JWT 인증 · Rate Limiting · CORS · 라우팅   │
└───────┬──────────────┬──────────────┬───────┘
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌───▼────────────┐
│ Auth Service │ │Core API    │ │Encryption      │
│ JWT 발급·갱신 │ │일기·루틴   │ │Service         │
│ bcrypt       │ │리포트·미션 │ │AES-256-GCM     │
└───────┬──────┘ └─────┬──────┘ └───┬────────────┘
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌───▼────────────┐
│Trigger Worker│ │Report      │ │Push Notifier   │
│routine_      │ │Scheduler   │ │루틴·일기 알림   │
│trigger.py    │ │주간·월간   │ │FCM / APNs      │
└───────┬──────┘ └─────┬──────┘ └────────────────┘
        │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────────────────┐
│ PostgreSQL   │ │   Redis    │ │ 암호화 저장소   │
│ 메인 DB      │ │JWT 블랙리스트│ │AES-256-GCM     │
│              │ │세션·캐시   │ │메모·평가지 원문 │
└──────────────┘ └────────────┘ └────────────────┘
```

---

## 레이어별 상세 설명

### 1. 클라이언트 레이어

| 항목 | 내용 |
|------|------|
| 프레임워크 | React Native (Expo) |
| 지원 플랫폼 | iOS 15 이상 / Android 9 이상 |
| 상태 관리 | Zustand |
| API 통신 | React Query + Axios |
| 스타일링 | NativeWind (Tailwind CSS) |
| 로컬 저장 | AsyncStorage (토큰 저장) |

**클라이언트 → 서버 통신 규칙**
- 모든 요청은 HTTPS (TLS 1.3)
- 인증이 필요한 요청은 `Authorization: Bearer {access_token}` 헤더 포함
- Access Token 만료 시 Refresh Token으로 자동 갱신

---

### 2. API 게이트웨이

모든 외부 요청의 단일 진입점.

| 기능 | 설명 |
|------|------|
| JWT 인증 미들웨어 | 토큰 유효성 검사, Redis 블랙리스트 확인 |
| Rate Limiting | IP당 분당 60 요청 제한 |
| CORS | 허용 Origin 화이트리스트 관리 |
| 요청 라우팅 | URI 기반으로 내부 서비스에 프록시 |
| 요청/응답 로깅 | 모든 API 호출 기록 (개인정보 제외) |

---

### 3. 애플리케이션 서비스

#### 3.1 Auth Service

인증·인가 전담 서비스.

| 기능 | 구현 |
|------|------|
| 회원가입 | 이메일 중복 확인 + bcrypt(cost 12) 해싱 |
| 로그인 | 비밀번호 검증 + JWT 발급 |
| 토큰 갱신 | Refresh Token 검증 + 새 토큰 발급 |
| 로그아웃 | Refresh Token → Redis 블랙리스트 등록 |
| 회원 탈퇴 | 데이터 파기 스케줄 등록 + 즉시 토큰 무효화 |

**JWT 구성**

| 토큰 | 만료 | 저장 위치 |
|------|------|---------|
| Access Token | 1시간 | 클라이언트 메모리 |
| Refresh Token | 14일 | AsyncStorage |

#### 3.2 Core API Service

비즈니스 로직 핵심 서비스.

| 모듈 | 담당 엔드포인트 |
|------|--------------|
| 일기 모듈 | POST·GET·PATCH /diaries |
| 루틴 모듈 | GET·POST·PATCH·DELETE /routines |
| 리포트 모듈 | GET /reports/weekly, /reports/monthly |
| 자가평가 모듈 | POST·GET /assessments |
| 미션 모듈 | GET /missions/weekly, /missions/total |
| 키워드 모듈 | GET /keywords/emotions |

#### 3.3 Encryption Service

민감 데이터 암호화·복호화 전담 서비스.

| 항목 | 내용 |
|------|------|
| 알고리즘 | AES-256-GCM |
| 암호화 대상 | 일기 자유 메모, 자가평가 원문 응답 |
| 키 관리 | 환경변수 분리 (`.env`), 소스코드 미포함 |
| IV (초기화 벡터) | 암호문마다 랜덤 생성, 암호문과 함께 저장 |

---

### 4. 백그라운드 워커

#### 4.1 Trigger Worker (`routine_trigger.py`)

일기 저장 이벤트 발생 시 비동기 실행.

```
트리거 실행 흐름:
1. 최근 7일 일기 데이터 조회 (PostgreSQL)
2. 감정 키워드 빈도 집계
3. 트리거 점수 산출
   - mood_score 기여분: (5 - mood_avg) / 5 × 0.3
   - 키워드 기여분: (키워드 빈도 / 전체 빈도) × 0.7
4. 3회 이상 등장 키워드 필터링
5. Redis에서 쿨다운(3일) 체크
6. 조건 충족 시 루틴 갱신 (단일 or 복합)
7. trigger_logs 기록
```

**알고리즘 핵심 코드**

> ⚠️ **[대체됨 2026-07-21]** 아래 가중합(mood 30% + 키워드 70%)은 mood 항이 상수라 발동·순위에
> 영향이 없는 no-op이었다(R1). 게이트 체인(G1~G5) 기반 신규 설계로 대체됨 —
> `docs/02-design/2026-07-21-트리거-재설계.design.md` 참조. 아래는 이력 보존용 원안이다.

```python
def calculate_trigger_score(diary_logs: list, days: int = 7) -> dict:
    recent_logs = diary_logs[-days:]
    keyword_freq = {}
    mood_avg = 0

    for log in recent_logs:
        mood_avg += log["mood_score"]
        for keyword in log["emotion_keywords"]:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1

    mood_avg /= len(recent_logs)
    total_freq = sum(keyword_freq.values())
    keyword_weights = {k: v / total_freq for k, v in keyword_freq.items()}

    trigger_scores = {}
    for keyword, weight in keyword_weights.items():
        mood_component = (5 - mood_avg) / 5 * 0.3
        keyword_component = weight * 0.7
        trigger_scores[keyword] = mood_component + keyword_component

    return trigger_scores


def evaluate_triggers(trigger_scores: dict, freq: dict, threshold: int = 3) -> list:
    triggered = [k for k, v in freq.items() if v >= threshold]
    if not triggered:
        return []
    triggered_sorted = sorted(
        triggered,
        key=lambda k: trigger_scores.get(k, 0),
        reverse=True
    )
    return triggered_sorted[:2]
```

#### 4.2 Report Scheduler

주간·월간 리포트 데이터 사전 집계.

| 항목 | 내용 |
|------|------|
| 실행 주기 | 매주 월요일 00:00 (주간), 매월 1일 00:00 (월간) |
| 작업 내용 | 지난 주/월 mood_score 집계, 키워드 빈도 집계, 달성률 계산 |
| 결과 저장 | PostgreSQL `report_cache` 또는 Redis 캐시 |

#### 4.3 Push Notifier

사용자 알림 발송 워커.

| 알림 종류 | 발송 조건 | 발송 시간 |
|---------|---------|---------|
| 루틴 알림 | 활성 루틴 있는 사용자 | 사용자 설정 시간 |
| 일기 알림 | 오늘 일기 미작성 | 사용자 설정 시간 |

**지원 플랫폼**
- Android: FCM (Firebase Cloud Messaging)
- iOS: APNs (Apple Push Notification Service)

---

### 5. 데이터 저장소

#### 5.1 PostgreSQL — 메인 데이터베이스

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 기본 정보 (email_hash, nickname) |
| `assessments` | PHQ-9 자가평가 결과 |
| `diary_entries` | 일기 기록 (mood_score, 암호화 메모) |
| `emotion_keywords` | 감정 키워드 마스터 데이터 |
| `diary_emotion_keywords` | 일기-감정키워드 다대다 |
| `situation_keywords` | 감정별 세부 질문 답변 |
| `routines` | 루틴 라이브러리 |
| `user_routines` | 사용자별 루틴 할당 |
| `routine_logs` | 루틴 완료 기록 |
| `trigger_logs` | 트리거 발동 이력 |
| `mission_points` | 주간 미션 점수 |

#### 5.2 Redis — 캐시 및 세션

| 키 패턴 | TTL | 용도 |
|--------|-----|------|
| `blacklist:{token}` | 토큰 만료 시간 | JWT 블랙리스트 |
| `session:{user_id}` | 14일 | 사용자 세션 |
| `cache:report:{user_id}:{week}` | 7일 | 리포트 캐시 |

#### 5.3 암호화 저장소

민감 데이터(일기 메모, 평가지 원문)를 AES-256-GCM으로 암호화하여 저장.

| 항목 | 내용 |
|------|------|
| 저장 형식 | `{IV}:{암호문}` (Base64 인코딩) |
| 키 분리 | 마스터 키는 환경변수, DB에 미저장 |
| 복호화 권한 | Encryption Service만 접근 가능 |

---

## 보안 아키텍처

### 네트워크 보안

```
외부 인터넷
     │
     │ HTTPS / TLS 1.3
     ▼
[API 게이트웨이] ─── 내부 네트워크 경계
     │
     ├── Auth Service
     ├── Core API Service
     ├── Encryption Service
     │
     ├── PostgreSQL    (내부 네트워크만 접근)
     ├── Redis         (내부 네트워크만 접근)
     └── 암호화 저장소  (Encryption Service만 접근)
```

### 개인정보 보호 설계

| 원칙 | 적용 |
|------|------|
| 식별 정보 분리 | email_hash ↔ 일기/평가지 테이블 물리적 분리 |
| 최소 수집 | 서비스에 필요한 최소한의 데이터만 수집 |
| 암호화 저장 | 민감 데이터(메모, 평가지) AES-256-GCM 암호화 |
| 전송 암호화 | 모든 API 통신 TLS 1.3 강제 |
| 데이터 파기 | 탈퇴 후 7일 이내 전체 파기 |

---

## 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 모바일 클라이언트 | React Native, Expo, Zustand, React Query |
| API 서버 | FastAPI (Python 3.11) + SQLAlchemy 2.0 + Alembic |
| 트리거 워커 | Python |
| 메인 DB | PostgreSQL |
| 캐시 / 세션 | Redis |
| 암호화 | AES-256-GCM, bcrypt |
| 인증 | JWT (RS256) |
| 푸시 알림 | FCM, APNs |
| 컨테이너 | Docker Compose |
