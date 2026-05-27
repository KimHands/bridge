# Bridge — 모바일 푸시 알림 시스템 설계

**작성일**: 2026-05-27
**대상 Phase**: Phase 10 (모바일 푸시 알림)
**의존 Phase**: Phase 1~8 백엔드 완료, Phase 9 (배포) 미실행 무관
**기술 선택**: Expo Push Service + APScheduler 인라인 발송

---

## 1. 목적

청년 디지털 정서 웰니스 플랫폼 Bridge의 5개 사용자 접점에서 적시 푸시 알림을 발송하여 루틴 형성·일기 작성 습관·정서 자기 인식을 돕는다. 의료적 진단·치료 표현 없이 정보 제공 및 습관 형성 도구로서의 도메인 원칙을 준수한다.

---

## 2. 5개 알림 시나리오

| # | 이름 | 발송 시점 | 발송 방식 | 딥링크 대상 |
|---|------|----------|----------|------------|
| 1 | 루틴 리마인더 | 사용자 설정 시각 (공통 1개, 기본 09:00 KST) | APScheduler 5분 주기 cron | Routine 탭 |
| 2 | 일기 작성 유도 | 매일 21:00 KST 고정, 당일 미작성자만 | APScheduler 일 1회 cron | DiaryMood (useStartDiary 사전 체크) |
| 3 | 트리거 발동 | `routine_trigger.py`가 새 user_routine INSERT 직후 | BackgroundTask 인라인 | Routine 탭 |
| 4 | 주간 미션 결과 | 매주 월요일 09:00 KST | APScheduler 주 1회 cron | Report 탭 |
| 5 | 자가평가 재진행 | 마지막 평가 후 8주 경과자, 매일 10:00 KST 발송 | APScheduler 일 1회 cron | Assessment 재진행 모드 |

---

## 3. 아키텍처

```
[Mobile (Expo SDK 51)]
    ↓ expo-notifications으로 ExpoPushToken 획득
    ↓ POST /v1/users/me/push-token (로그인/자동로그인 직후)
[Backend API (FastAPI)]
    ├─ device_tokens 테이블 저장
    ├─ APScheduler 5개 신규 cron job
    │    ├─ 시나리오 1: routine_reminder (매 5분 체크)
    │    ├─ 시나리오 2: diary_nudge (일 1회 21:00 KST)
    │    ├─ 시나리오 4: weekly_mission_notification (주 1회 월 09:00 KST)
    │    ├─ 시나리오 5: assessment_reminder (일 1회 10:00 KST)
    │    └─ Hygiene: cleanup_stale_tokens_and_logs (일 1회 03:00 KST)
    └─ routine_trigger.py BackgroundTask
         └─ 시나리오 3: 트리거 발동 시 인라인 발송
    ↓ HTTPS POST (chunk size 100)
[Expo Push API (exp.host/--/api/v2/push/send)]
    ↓
[FCM / APNs] → 사용자 디바이스
    ↓ 사용자 탭
[Mobile] expo-notifications listener → React Navigation으로 시나리오별 화면 이동
```

### 핵심 모듈

**백엔드 신규**
- `backend/app/services/notification.py` — Expo Push API 클라이언트 + 발송 로직 + 시나리오별 함수
- `backend/app/api/v1/notifications.py` — 토큰 등록·해지·설정 엔드포인트
- `backend/app/models/notification.py` — DeviceToken, NotificationSetting, NotificationLog
- `backend/app/schemas/notification.py` — Pydantic 스키마
- `backend/alembic/versions/<rev>_add_notification_tables.py` — 마이그레이션

**모바일 신규**
- `mobile/src/lib/notifications.ts` — 권한·토큰·발송 채널 설정 헬퍼
- `mobile/src/hooks/usePushNotifications.ts` — App.tsx 루트 훅 (권한 + 등록 + 리스너)
- `mobile/src/types/notification.ts` — NotificationPayload·Settings 타입
- `mobile/src/screens/my/NotificationSettingsScreen.tsx` — 설정 화면

**기존 파일 수정**
- `backend/app/scheduler.py` — 4개 cron job 추가 + Hygiene job 추가
- `backend/app/routine_trigger.py` — 트리거 발동 후 알림 발송 호출
- `backend/app/api/v1/auth.py` — 로그아웃 시 토큰 비활성화
- `backend/app/main.py` — notifications 라우터 등록
- `mobile/App.tsx` — usePushNotifications() 호출
- `mobile/src/lib/api.ts` — notifications 클라이언트 메서드 추가
- `mobile/src/screens/auth/LoginScreen.tsx`, `SplashScreen.tsx` — 토큰 등록 호출
- `mobile/src/screens/my/MyPageScreen.tsx` — "알림 설정" 메뉴 추가
- `mobile/app.json` — expo-notifications 플러그인 + iOS/Android 권한 설정
- `mobile/package.json` — expo-notifications 의존성 추가

---

## 4. 데이터 모델

### 4.1 device_tokens

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id (CASCADE) | |
| expo_token | VARCHAR(255) | UNIQUE NOT NULL | `ExponentPushToken[xxx]` 형식 |
| platform | VARCHAR(10) | NOT NULL | `'ios'` \| `'android'` |
| device_name | VARCHAR(100) | NULL | 사용자 식별용 (선택) |
| is_active | BOOLEAN | DEFAULT TRUE | Expo `DeviceNotRegistered` 응답 시 FALSE |
| last_used_at | TIMESTAMP | DEFAULT NOW() | 발송 시도 시 갱신 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**인덱스**: `(user_id, is_active)` 발송 조회용

**다중 디바이스 정책**: 한 사용자 = N개 토큰 허용 (폰 + 태블릿 등). 토큰 충돌 시 user_id 갱신 + is_active=TRUE upsert.

### 4.2 notification_settings (1:1 with users)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| user_id | UUID | PK FK → users.id | |
| push_enabled | BOOLEAN | DEFAULT TRUE | 전체 ON/OFF 토글 |
| routine_reminder_time | TIME | DEFAULT '09:00' | 공통 루틴 알림 시각 (KST 기준) |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

**시간대 표기**: `routine_reminder_time`은 항상 KST로 저장. 발송 함수에서 KST로 비교.

### 4.3 notification_logs

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK | |
| notification_type | VARCHAR(30) | NOT NULL | `routine_reminder` \| `diary_nudge` \| `trigger` \| `weekly_mission` \| `assessment_reminder` |
| title | VARCHAR(100) | NOT NULL | 알림 제목 (도메인 금지어 가드 통과) |
| body | VARCHAR(500) | NOT NULL | 알림 본문 (사용자 일기 내용·감정 키워드 평문 금지) |
| data_payload | JSONB | NOT NULL | `{type, target_screen, ...}` |
| status | VARCHAR(20) | NOT NULL | `'sent'` \| `'failed'` \| `'skipped'` |
| error_message | TEXT | NULL | Expo 응답 에러 코드·메시지 |
| sent_at | TIMESTAMP | DEFAULT NOW() | |

**민감정보 보호**:
- 일기 본문·감정 키워드 평문 저장 금지
- PHQ-9 점수·구간명 저장 금지
- 보존 기간 90일 (Hygiene cron 정리)

### 4.4 Alembic 마이그레이션

단일 revision으로 3개 테이블 + 인덱스 추가. 기존 사용자에게 `notification_settings` INSERT (`push_enabled=true, routine_reminder_time='09:00'` 기본값).

---

## 5. API 엔드포인트

| 메서드 | 경로 | 용도 | 인증 |
|--------|------|------|------|
| POST | `/v1/users/me/push-token` | 토큰 등록 (expo_token UNIQUE 기준 upsert) | JWT |
| DELETE | `/v1/users/me/push-token` | 로그아웃 시 토큰 비활성화 (body로 expo_token 전달) | JWT |
| GET | `/v1/users/me/notification-settings` | 현재 알림 설정 조회 | JWT |
| PATCH | `/v1/users/me/notification-settings` | `push_enabled`, `routine_reminder_time` 변경 | JWT |

### 요청/응답 예

**POST /v1/users/me/push-token**
```jsonc
// Request
{
  "expo_token": "ExponentPushToken[xxx]",
  "platform": "ios",
  "device_name": "iPhone 15"  // optional
}
// Response (SuccessResponse<T> 래핑)
{ "success": true, "data": { "registered": true } }
```

**PATCH /v1/users/me/notification-settings**
```jsonc
// Request
{ "push_enabled": true, "routine_reminder_time": "08:30" }
// Response
{ "success": true, "data": { "push_enabled": true, "routine_reminder_time": "08:30" } }
```

### 기존 엔드포인트 변경

`POST /v1/auth/logout` — 변경 없음. 로그아웃 시 모바일 클라이언트가 명시적으로 `DELETE /v1/users/me/push-token`을 호출하여 해당 디바이스 토큰만 `is_active=FALSE`로 비활성화. 호출 실패 시 토큰은 유지 (다른 기기 알림 영향 없음, 다음 로그인 시 갱신).

---

## 6. 모바일 통합

### 6.1 의존성

`mobile/package.json`에 추가:
```json
"expo-notifications": "~0.28.0",
"expo-device": "~6.0.0"
```

### 6.2 app.json 플러그인 설정

```json
{
  "expo": {
    "plugins": [
      "expo-secure-store",
      "expo-font",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#5B558E"
        }
      ]
    ],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.bridge.mobile",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "package": "app.bridge.mobile",
      "useNextNotificationsApi": true
    }
  }
}
```

### 6.3 권한 흐름

1. 앱 시작 → `Notifications.getPermissionsAsync()`로 현재 상태 확인
2. `undetermined`면 자동 요청 안 함 (사용자 피로감 방지) → 첫 로그인 직후 1회 요청
3. 거부 시 마이페이지 알림 설정 화면에서 "iOS 설정 앱 열기" 안내 (Linking.openSettings)
4. 권한 획득 → `Notifications.getExpoPushTokenAsync({ projectId })`로 토큰 발급 → 백엔드 등록

### 6.4 알림 탭 → 화면 매핑 (`data.type`)

| `data.type` | React Navigation 이동 |
|-------------|----------------------|
| `routine_reminder` | MainTabs → Routine 탭 |
| `diary_nudge` | DiaryMood (useStartDiary 사전 체크 통과 시) |
| `trigger` | MainTabs → Routine 탭 |
| `weekly_mission` | MainTabs → Report 탭 |
| `assessment_reminder` | Assessment 화면 (`mode='retry'` 또는 신규 진행) |

### 6.5 마이페이지 알림 설정 화면

- 토글 1개: "푸시 알림 받기" (`push_enabled`)
- 시간 선택 1개: "루틴 알림 시각" (`routine_reminder_time`, TimePickerComponent)
- 권한 거부 상태 안내 카드: "iOS 설정에서 알림 허용 필요" + "설정 열기" 버튼

---

## 7. 스케줄링 로직

### 7.1 APScheduler 신규 job

`backend/app/scheduler.py`에 추가:

```python
# UTC 기준 (scheduler.timezone="UTC"), KST = UTC + 9

# 시나리오 1: 루틴 리마인더 — 매 5분마다 체크
# 사용자 routine_reminder_time이 (now KST) ± 2.5분 범위면 발송
scheduler.add_job(
    send_routine_reminders,
    CronTrigger(minute="*/5"),
    id="routine_reminder",
    replace_existing=True,
)

# 시나리오 2: 일기 미작성 — 매일 21:00 KST = UTC 12:00
scheduler.add_job(
    send_diary_nudges,
    CronTrigger(hour=12, minute=0),
    id="diary_nudge",
    replace_existing=True,
)

# 시나리오 4: 주간 미션 결과 — 월 09:00 KST = UTC 일 00:00
scheduler.add_job(
    send_weekly_mission_notifications,
    CronTrigger(day_of_week="sun", hour=0, minute=0),
    id="weekly_mission_notification",
    replace_existing=True,
)

# 시나리오 5: 자가평가 재진행 — 매일 10:00 KST = UTC 01:00
scheduler.add_job(
    send_assessment_reminders,
    CronTrigger(hour=1, minute=0),
    id="assessment_reminder",
    replace_existing=True,
)

# Hygiene: 90일 미사용 device_tokens + 90일 지난 notification_logs cleanup
# 매일 03:00 KST = UTC 18:00
scheduler.add_job(
    cleanup_stale_tokens_and_logs,
    CronTrigger(hour=18, minute=0),
    id="notification_cleanup",
    replace_existing=True,
)
```

### 7.2 시나리오 3 (트리거 즉시) — `routine_trigger.py` 통합

`routine_trigger.py`의 `run_trigger()` 함수에서 새 `user_routine` INSERT 직후:
```python
await notification_service.send_trigger_notification(
    user_id=user_id,
    routine=new_routine,
    db=db,
)
```

`routine_trigger.py`는 이미 BackgroundTask 내에서 실행되므로 추가 비동기 처리 불필요.

### 7.3 발송 함수 공통 패턴

```
async def send_xxx(db):
    1. notification_settings.push_enabled=TRUE 사용자 필터
    2. 시나리오별 추가 조건 필터:
       - send_routine_reminders: routine_reminder_time이 현재 시각 ± 2.5분 범위
       - send_diary_nudges: 당일 diary_entries 없음
       - send_weekly_mission_notifications: 이번 주 mission_points 존재
       - send_assessment_reminders: 마지막 PHQ-9 평가 후 56일 (8주) 경과 + 최근 14일 내 알림 미발송
    3. 각 사용자의 device_tokens 조회 (is_active=TRUE)
    4. 시나리오별 message body 생성 (도메인 금지어 가드 통과)
    5. Expo Push API에 100개 단위 chunk POST
    6. 응답 파싱:
       - DeviceNotRegistered → device_tokens.is_active=FALSE
       - 그 외 실패 → notification_logs.status='failed'
       - 성공 → notification_logs.status='sent', device_tokens.last_used_at 갱신
```

### 7.4 자가평가 알림 중복 방지

매일 10:00 KST 발송이지만 동일 사용자에게 매일 발송되면 피로감. 최근 14일 내 `notification_logs`에 `notification_type='assessment_reminder'`가 있으면 skip. 사용자가 재평가 진행하면 PHQ-9 latest_at 갱신되어 56일 카운터 리셋.

---

## 8. 알림 문구 (도메인 원칙 준수)

| 시나리오 | 제목 | 본문 |
|---------|------|------|
| 1. 루틴 리마인더 | 오늘의 루틴 시간이에요 | 잠시 멈추고 루틴 하나 함께해요 |
| 2. 일기 미작성 | 오늘 하루는 어땠나요? | 한 줄로 가볍게 기록해볼까요 |
| 3. 트리거 (새 루틴) | 새 루틴이 도착했어요 | 요즘 마음에 맞는 루틴을 준비했어요 |
| 4. 주간 미션 결과 | 이번 주 기록을 모았어요 | 한 주를 차분히 돌아볼 시간 |
| 5. 자가평가 8주 경과 | 마음 상태를 확인해볼까요 | 8주 만에 다시 살펴보는 시간 |

### 8.1 금지 표현 가드

`backend/app/services/notification.py` 모듈 상수:
```python
_BANNED_TERMS = {
    # 의료 표현
    "치료", "진단", "개선", "효과", "장애", "병원", "의사",
    # 도메인 금지 표현
    "우울", "중등도", "PHQ", "GAD",
    # 평가지·구간명
    "구간", "점수",
}
```

배포 시 알림 문구 단위 테스트로 금지어 미포함 검증. 동적 생성 문구(트리거의 routine title 포함) 시 sanitize 함수 적용.

### 8.2 일기 평문 노출 금지

알림 body 및 `notification_logs`에 일기 본문·감정 키워드 평문·PHQ-9 점수 절대 포함 금지. 일반화된 "한 주 기록", "최근 마음" 등 표현만 허용.

---

## 9. 에러 처리

| 상황 | 처리 |
|------|------|
| Expo Push API 5xx 응답 | 로그 기록, 재시도 안 함 (다음 cron 사이클 자연 복구) |
| Expo `DeviceNotRegistered` | `device_tokens.is_active=FALSE` |
| Expo `MessageTooBig` / `InvalidCredentials` | `notification_logs.status='failed'`, 운영팀 알림 (Phase 11 후속) |
| 토큰 미등록 사용자 | 발송 함수 진입 자체에서 필터, `notification_logs` 미기록 |
| 모바일 권한 거부 | 마이페이지 알림 설정 화면에서 OS 설정 진입 안내 |
| 푸시 비활성화 사용자 (`push_enabled=FALSE`) | 발송 SKIP, `notification_logs.status='skipped'` 미기록 (불필요 노이즈 방지) |

---

## 10. 테스트 전략

### 단위 테스트
- 알림 문구 생성 함수: 시나리오별 title/body 정합
- 도메인 금지어 가드: `_BANNED_TERMS` 포함 시 ValueError raise
- `send_routine_reminders` 시간 비교 로직: KST 기준 ± 2.5분 윈도우
- 자가평가 8주 경과 + 14일 중복 방지 조건

### 통합 테스트
- Expo Push API mock으로 5개 시나리오별 발송 함수 호출 검증
- `notification_logs` 기록 정합성
- `DeviceNotRegistered` 응답 시 `is_active=FALSE` 처리

### 수동 테스트
- Expo Push Tool (web, https://expo.dev/notifications)로 테스트 토큰 발송 → 모바일 알림 수신 확인
- iOS Simulator: 알림 권한 다이얼로그 흐름, 딥링크 5종
- Android Emulator: FCM 채널 설정, foreground/background 알림 동작

### 검증 시나리오
1. 신규 가입 사용자 → 토큰 등록 → 시나리오 2 (21:00) 발송 수신
2. PHQ-9 완료 사용자 → 트리거 발동 → 시나리오 3 즉시 수신
3. 푸시 OFF 토글 → 모든 시나리오 발송 SKIP 확인
4. 앱 강제 종료 → 알림 탭 → 딥링크 화면 진입 확인 (lastNotificationResponse)

---

## 11. 보안 고려사항

- **HTTPS 전송**: Expo Push API 호출은 TLS 1.3 (기본). 토큰은 헤더 없이 body로 전달.
- **expo_token 노출 위험**: GitHub 리포 커밋 금지. `notification_logs.data_payload`에도 평문 저장 금지.
- **민감 데이터 격리** (CLAUDE.md 정책 준수):
  - 일기 본문은 AES-256-GCM 암호화 상태로 DB 저장
  - 알림 발송 시 일기 본문·감정 키워드·PHQ-9 점수 평문 사용 금지
- **인증 강제**: 4개 API 모두 JWT 필수. `users/me` 패턴으로 다른 사용자 토큰 조작 차단.
- **푸시 폭주 방지**: 각 시나리오는 발송 빈도가 자연 제한됨
  - 시나리오 1 (루틴 리마인더): 사용자 설정 시각 1회/일
  - 시나리오 2 (일기 미작성): 21:00 KST 1회/일
  - 시나리오 3 (트리거): `trigger_logs` cooldown 3일
  - 시나리오 4 (주간 미션): 주 1회 (월 09:00)
  - 시나리오 5 (자가평가): 14일 중복 방지 가드

---

## 12. 도메인 원칙 준수 체크리스트

- [x] 의료 표현 사용 안 함 ("치료/진단/개선/효과/장애/우울")
- [x] PHQ-9 점수·구간명 사용자 노출 안 함
- [x] 일기 본문 평문 알림 body 포함 안 함
- [x] 감정 키워드 평문 알림 body 포함 안 함
- [x] LLM 기반 알림 문구 생성 안 함 (정적 문구만 사용)
- [x] 정신건강 데이터 제3자 제공 안 함 (Expo는 운반 채널만)

---

## 13. 후속 확장 로드맵 (Phase 11+)

### 13.1 루틴별 개별 시간 설정 ← MVP 후 1순위

- `user_routines` 테이블에 `reminder_time TIME NULL` 컬럼 추가 (Alembic)
- NULL이면 `notification_settings.routine_reminder_time` 폴백
- 모바일 RoutineDetail 화면에 "이 루틴만 다른 시간" 토글 + 시각 선택 추가
- `send_routine_reminders` 함수에서 `COALESCE(ur.reminder_time, ns.routine_reminder_time)` 사용
- 마이그레이션 시 기존 데이터 영향 없음 (NULL fallback)

### 13.2 알림 카테고리별 ON/OFF

- `notification_settings`에 `routine_enabled, diary_enabled, trigger_enabled, mission_enabled, assessment_enabled` 컬럼 추가
- 마이페이지 알림 설정 화면 토글 5개 확장
- 발송 함수에 카테고리별 가드 추가

### 13.3 방해금지 시간대 (quiet hours)

- `notification_settings.quiet_start_time, quiet_end_time` 컬럼 추가
- 발송 함수에 시간 범위 가드 (트리거 시나리오도 적용)

### 13.4 알림 통계 대시보드 (관리자)

- `notification_logs` 기반 발송 성공률, 시나리오별 효과 분석
- 클라이언트 클릭률 추적 (모바일에서 `Notifications.addNotificationResponseReceivedListener`로 POST `/v1/notifications/click`)

---

## 14. 구현 순서 (제안)

1. **DB 마이그레이션 + 모델** (`models/notification.py` + Alembic) — 약 0.5일
2. **백엔드 API 4종** (`api/v1/notifications.py` + schemas) — 약 0.5일
3. **알림 발송 서비스** (`services/notification.py` Expo Push 클라이언트) — 약 0.5일
4. **APScheduler job 4개** (`scheduler.py` 확장) — 약 0.5일
5. **routine_trigger.py 시나리오 3 통합** — 약 0.25일
6. **모바일 expo-notifications 통합** (lib/notifications.ts + hook + App.tsx) — 약 1일
7. **알림 설정 화면 + 마이페이지 진입점** — 약 0.5일
8. **딥링크 5종 + 권한 거부 안내** — 약 0.5일
9. **단위·통합 테스트 작성** — 약 0.5일
10. **수동 QA + 도메인 금지어 검증** — 약 0.5일

**총 예상 공수**: 약 5일 (백엔드 2.25일 + 모바일 2일 + 테스트 0.75일)

---

## 15. 미결정 사항 (구현 단계에서 결정)

- `notification-icon.png` 디자인 자산 — 디자이너 합류 시점 결정
- Expo `projectId` 발급 — EAS 프로젝트 생성 시점 결정 (Phase 9 배포와 연계 가능)
- 알림 채널(Android) 그룹화 정책 — 5개 시나리오 각각 별도 채널 vs 1개 통합 채널 → 사용자 시스템 설정 세분화 정책에 따라 결정 (MVP는 통합 1개 채널 권장)
