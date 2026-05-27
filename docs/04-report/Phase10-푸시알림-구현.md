# Phase 10 — 모바일 푸시 알림 구현 리포트

**완료일**: 2026-05-27
**브랜치**: `feature/phase-10-push-notifications`
**구현 범위**: 5개 시나리오 + Expo Push Service + APScheduler 인라인 발송
**스펙**: [docs/superpowers/specs/2026-05-27-mobile-push-notifications-design.md](../superpowers/specs/2026-05-27-mobile-push-notifications-design.md)
**계획**: [docs/superpowers/plans/2026-05-27-mobile-push-notifications.md](../superpowers/plans/2026-05-27-mobile-push-notifications.md)

---

## 1. 결과 요약

| 항목 | 결과 |
|------|------|
| 총 Task | 25개 (모두 완료) |
| 총 커밋 | 23개 (`feature/phase-10-push-notifications` 브랜치) |
| 백엔드 단위 테스트 | 12/12 PASS (도메인 금지어 5 + KST 윈도우 4 + 8주 경과 3) |
| 모바일 TypeScript | 0 errors |
| 신규 API 엔드포인트 | 4개 (`/v1/users/me/push-token` POST·DELETE, `/v1/users/me/notification-settings` GET·PATCH) |
| 신규 DB 테이블 | 3개 (`device_tokens`, `notification_settings`, `notification_logs`) |
| APScheduler 신규 job | 5개 (시나리오 1·2·4·5 + Hygiene) — 기존 `weekly_mission_aggregate` 포함 총 6 jobs 운영 중 |
| 시나리오 3 (트리거 즉시) | `routine_trigger.py`의 BackgroundTask 내 인라인 발송 (다중 루틴 케이스 처리) |

---

## 2. 신규 자산

### 백엔드
```
backend/app/models/notification.py              # DeviceToken, NotificationSetting, NotificationLog
backend/app/schemas/notification.py             # Pydantic 스키마 6종
backend/app/services/__init__.py
backend/app/services/notification.py            # 도메인 금지어 가드 + Expo Push 클라이언트 + 5개 시나리오
backend/app/api/v1/notifications.py             # 4개 엔드포인트
backend/alembic/versions/94a7a5657c8e_*.py      # 마이그레이션 (3 테이블 + 2 인덱스 + 기존 사용자 backfill)
backend/tests/test_notification_messages.py     # 5개 단위 테스트
backend/tests/test_notification_scheduling.py   # 7개 단위 테스트
backend/pytest.ini, backend/tests/conftest.py
```

### 모바일
```
mobile/src/types/notification.ts                # NotificationType, NotificationPayload, Settings
mobile/src/lib/notifications.ts                 # 권한·토큰·Android 채널 헬퍼
mobile/src/hooks/usePushNotifications.ts        # 권한 + 등록 + 리스너 통합
mobile/src/hooks/useNotificationDeepLink.ts     # 시나리오별 화면 라우팅
mobile/src/screens/my/NotificationSettingsScreen.tsx  # 설정 화면 (토글 + 시각 선택)
```

### 의존성 추가
- 백엔드: `httpx==0.27.2`, `pytest==8.3.3`, `pytest-asyncio==0.23.8`
- 모바일: `expo-notifications@~0.28.19`, `expo-device@~6.0.2`, `@react-native-community/datetimepicker`

---

## 3. 시나리오별 동작 검증 결과

| # | 시나리오 | 발송 트리거 | 검증 상태 |
|---|---------|-----------|---------|
| 1 | 루틴 리마인더 | `routine_reminder` cron (5분마다, KST ±2.5분 윈도우) | 백엔드 함수 호출 OK, 단위 테스트 4개 PASS |
| 2 | 일기 미작성 | `diary_nudge` cron (매일 21:00 KST) | 백엔드 함수 호출 OK |
| 3 | 트리거 발동 | `routine_trigger.py` 내 인라인 발송 | 다중 루틴 케이스 처리 포함 |
| 4 | 주간 미션 결과 | `weekly_mission_notification` cron (월 09:00 KST) | 백엔드 함수 호출 OK |
| 5 | 자가평가 8주 경과 | `assessment_reminder` cron (매일 10:00 KST) + 14일 dedupe | 단위 테스트 3개 PASS |

---

## 4. 도메인 원칙 준수 (CLAUDE.md 규제 가이드)

- 알림 문구 전체에서 의료 표현 (`치료/진단/개선/효과/장애/우울/PHQ/GAD/구간/점수`) 금지 — 단위 테스트로 자동 검증
- 일기 본문·감정 키워드 평문 알림 body 포함 금지 (정적 문구만 사용)
- PHQ-9 점수·구간명 비노출
- LLM 기반 알림 문구 생성 안 함 (모두 정적 NOTIFICATION_MESSAGES 상수)
- 정신건강 데이터 제3자 제공 안 함 (Expo는 운반 채널만)

---

## 5. 미완 / 보류 항목

### EAS 셋업 필요 작업 (Phase 11 또는 Phase 9 배포와 묶음)
- EAS Development Build로 실제 디바이스 푸시 토큰 발급 검증
- iOS 시뮬레이터는 토큰 발급 불가 — 코드는 `Device.isDevice=false`로 graceful skip
- Expo Push Tool로 5개 시나리오 실제 발송 테스트

### 디자인 자산 보류
- `notification-icon.png` (96x96 흑백 단색, Android용) 미생성
- 보류 사유: 디자이너 자산 미합류 (메모리 #24 동일 사유)
- 추후 `mobile/app.json`의 `expo-notifications` plugin `icon` 옵션 추가 필요

### MVP 범위 제한 사항
- 시나리오별 화면 딥링크는 `Main`까지만 보장 (BottomTab 내부 Routine/Report 탭 진입은 navigation ref 기반 nested navigate 필요 — Phase 11 후속)
- 알림 카테고리별 ON/OFF 미구현 (전체 ON/OFF 토글만, 스펙 섹션 13.2)
- 방해금지 시간대(quiet hours) 미구현 (스펙 섹션 13.3)
- 루틴별 개별 시간 설정 미구현 — MVP 후 1순위 (스펙 섹션 13.1)

---

## 6. 후속 확장 후보 (스펙 섹션 13)

1. **루틴별 개별 시간 설정** ← MVP 후 1순위
   - `user_routines.reminder_time TIME NULL` 컬럼 추가
   - NULL이면 `notification_settings.routine_reminder_time` 폴백
   - 모바일 RoutineDetail 화면에 토글 + 시각 선택 추가

2. **알림 카테고리별 ON/OFF** — `notification_settings`에 5개 boolean 컬럼 + 마이페이지 토글 확장

3. **방해금지 시간대** — `notification_settings.quiet_start_time, quiet_end_time` + 발송 함수 시간 범위 가드

4. **알림 통계 대시보드** — `notification_logs` 기반 발송 성공률·클릭률 분석

5. **BottomTab nested deep link** — NavigationRef + nested navigate 구현

---

## 7. 운영 시 주의사항

- **EAS projectId 필수**: 실제 푸시 발급 시 `mobile/app.json`에 `expo.extra.eas.projectId` 추가 필요
- **운영 환경 변수**: `EXPO_PUBLIC_API_URL=https://api.bridge.app/v1` 주입 필수 (EAS Build 시)
- **APScheduler timezone**: 모든 cron job `timezone="UTC"` 명시. KST 시각은 UTC로 환산하여 등록 (UTC 12:00 = KST 21:00)
- **Hygiene cron**: 매일 03:00 KST에 90일 미사용 토큰 비활성화 + 90일 지난 로그 삭제 자동 실행
- **알림 발송 폭주 방지 자연 제한**:
  - 시나리오 1: 사용자 설정 시각 1회/일
  - 시나리오 2: 21:00 1회/일
  - 시나리오 3: `trigger_logs` cooldown 3일
  - 시나리오 4: 주 1회
  - 시나리오 5: 14일 dedupe 가드

---

## 8. 다음 세션 권장 작업

1. **EAS 프로젝트 셋업** + Development Build 1회 발급 → 실제 디바이스에서 시나리오 5개 발송 검증
2. **알림 아이콘 자산 생성** → `expo-notifications` plugin에 등록
3. **BottomTab nested deep link** → Routine/Report 탭으로 정확한 진입
4. **Phase 9 AWS 배포 실행** (병행 가능) → 운영 환경에서 푸시 통합 검증
5. **PR 머지** → `feature/phase-10-push-notifications` → `main`
