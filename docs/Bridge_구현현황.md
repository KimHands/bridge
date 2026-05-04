# Bridge 구현 현황 (Inventory)

> **스냅샷 기준일**: 2026-05-04
> **검토 방법**: 코드 직접 스캔 (`mobile/src/screens/`, `backend/app/api/v1/`, `backend/app/models/`)
> **목적**: 현재 코드베이스에 실제로 존재하는 화면·API·테이블의 정확한 개수와 목록 정리

---

## 총합 요약

| 영역 | 개수 | 비고 |
|------|------|------|
| 모바일 화면 | **20개** | `mobile/src/screens/` 하위 `.tsx` 파일 기준 |
| 백엔드 API | **24개** | `/v1` prefix 23개 + 루트 헬스체크 1개 |
| DB 테이블 | **11개** | SQLAlchemy `__tablename__` 선언 기준 |

---

## 1. 모바일 화면 (20개)

### 1.1 인증·온보딩 (`screens/auth/`) — 6개

| 화면 | 파일 | 역할 |
|------|------|------|
| Splash | `SplashScreen.tsx` | 앱 진입 스플래시 / 토큰 자동 로그인 분기 |
| Onboarding | `OnboardingScreen.tsx` | 최초 진입 안내 |
| Signup | `SignupScreen.tsx` | 회원가입 (이메일·비밀번호·닉네임) |
| Login | `LoginScreen.tsx` | 로그인 |
| Assessment | `AssessmentScreen.tsx` | PHQ-9 자가평가 |
| InitialRoutine | `InitialRoutineScreen.tsx` | 자가평가 결과 → 초기 루틴 배정 |

### 1.2 메인 탭 (`screens/main/`) — 5개

| 화면 | 파일 | 역할 |
|------|------|------|
| Home | `HomeScreen.tsx` | 홈 (오늘 일기 상태·루틴) |
| DiaryList | `DiaryListScreen.tsx` | 일기 목록 |
| Routine | `RoutineScreen.tsx` | 내 루틴 목록·완료 처리 |
| Report | `ReportScreen.tsx` | 주간/월간 리포트 |
| MyPage | `MyPageScreen.tsx` | 마이페이지 |

### 1.3 일기 작성 플로우 (`screens/diary/`) — 5개

| 화면 | 파일 | 역할 |
|------|------|------|
| DiaryMood | `DiaryMoodScreen.tsx` | 1단계 — 이모지 기반 mood 선택 |
| DiaryKeyword | `DiaryKeywordScreen.tsx` | 2단계 — 감정 키워드 선택 |
| DiaryQuestion | `DiaryQuestionScreen.tsx` | 3단계 — 키워드별 세부 질문 |
| DiaryMemo | `DiaryMemoScreen.tsx` | 4단계 — 메모 작성 (AES-256-GCM 암호화 대상) |
| DiaryDetail | `DiaryDetailScreen.tsx` | 작성된 일기 상세 보기 |

### 1.4 루틴 관리 (`screens/routine/`) — 2개

| 화면 | 파일 | 역할 |
|------|------|------|
| RoutineAdd | `RoutineAddScreen.tsx` | 루틴 라이브러리에서 루틴 추가 |
| RoutineDetail | `RoutineDetailScreen.tsx` | 루틴 상세 / 완료 이력 |

### 1.5 마이페이지 하위 (`screens/my/`) — 1개

| 화면 | 파일 | 역할 |
|------|------|------|
| ProfileEdit | `ProfileEditScreen.tsx` | 프로필 (닉네임 등) 수정 |

### 1.6 법적 고지 (`screens/legal/`) — 1개

| 화면 | 파일 | 역할 |
|------|------|------|
| Legal | `LegalScreen.tsx` | 이용약관·개인정보처리방침 표시 |

---

## 2. 백엔드 API (24개)

Base URL (개발): `http://localhost:8000`
v1 Prefix: `/v1`

### 2.1 Auth (`/v1/auth`) — 5개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/v1/auth/register` | 회원가입 + JWT 발급 |
| POST | `/v1/auth/login` | 로그인 + JWT 발급 |
| POST | `/v1/auth/refresh` | Access Token 재발급 |
| GET | `/v1/auth/me` | 내 정보 조회 |
| POST | `/v1/auth/logout` | 로그아웃 (Refresh 블랙리스트 등록) |

### 2.2 Assessments (`/v1/assessments`) — 2개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/v1/assessments` | PHQ-9 자가평가 제출 + 초기 루틴 배정 |
| GET | `/v1/assessments` | 내 자가평가 이력 조회 |

### 2.3 Diaries (`/v1/diaries`) — 5개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/v1/diaries` | 일기 생성 (메모 암호화 저장 + 트리거 워커 비동기 호출) |
| GET | `/v1/diaries/today/status` | 오늘 일기 작성 여부 확인 |
| GET | `/v1/diaries` | 일기 목록 |
| GET | `/v1/diaries/{diary_id}` | 일기 상세 |
| PATCH | `/v1/diaries/{diary_id}` | 일기 수정 |

### 2.4 Keywords (`/v1/keywords`) — 1개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/keywords/emotions` | 감정 키워드 마스터 목록 (8개) |

### 2.5 Routines (`/v1/routines`) — 5개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/routines/me` | 내 활성 루틴 목록 |
| GET | `/v1/routines/library` | 루틴 라이브러리 (전체 마스터) |
| POST | `/v1/routines/me` | 루틴 수동 추가 (`source: manual`) |
| PATCH | `/v1/routines/{user_routine_id}/complete` | 루틴 완료 처리 + 미션 점수 적립 |
| DELETE | `/v1/routines/{user_routine_id}` | 사용자 루틴 삭제 |

### 2.6 Missions (`/v1/missions`) — 2개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/missions/weekly` | 이번 주 미션 점수 |
| GET | `/v1/missions/total` | 누적 미션 점수 |

### 2.7 Reports (`/v1/reports`) — 3개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/reports/weekly` | 주간 리포트 |
| GET | `/v1/reports/monthly` | 월간 리포트 |
| GET | `/v1/reports/mood-trend` | mood 추이 (차트용) |

### 2.8 시스템 — 1개

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 (Docker healthcheck·`scripts/start.sh`에서 사용) |

> **참고**: `docs/Bridge_API_명세서.md` 의 명세 일부(예: `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`)는 **아직 미구현**. 현재는 `GET /v1/auth/me` 하나로만 사용자 정보를 조회한다.

---

## 3. DB 테이블 (11개)

`backend/app/models/` 의 SQLAlchemy 모델에서 `__tablename__` 으로 선언된 테이블 전체.

| # | 테이블 | 정의 파일 | 역할 |
|---|--------|----------|------|
| 1 | `users` | `models/user.py` | 사용자 (email_hash, nickname, password_hash) |
| 2 | `assessments` | `models/assessment.py` | PHQ-9 자가평가 결과 (암호화된 응답) |
| 3 | `diary_entries` | `models/diary.py` | 일기 (mood_score, 암호화 메모) |
| 4 | `emotion_keywords` | `models/keyword.py` | 감정 키워드 마스터 (8개 시드) |
| 5 | `diary_emotion_keywords` | `models/keyword.py` | 일기 ↔ 감정키워드 다대다 |
| 6 | `situation_keywords` | `models/keyword.py` | 감정별 세부 질문 답변 |
| 7 | `routines` | `models/routine.py` | 루틴 라이브러리 (마스터) |
| 8 | `user_routines` | `models/routine.py` | 사용자별 활성 루틴 (`source: initial/trigger/manual`) |
| 9 | `routine_logs` | `models/routine.py` | 루틴 완료 이력 |
| 10 | `mission_points` | `models/mission.py` | 주간 미션 점수 |
| 11 | `trigger_logs` | `models/mission.py` | 트리거 발동 이력 (`cooldown_until` 포함) |

> **마이그레이션**: `alembic/versions/727926d67cb3_initial.py` 단일 리비전으로 11개 테이블 모두 생성됨.

---

## 4. 검증 방법 (재실행 가능)

문서가 stale 해졌는지 확인하려면 아래 명령으로 재집계:

```bash
# 모바일 화면 개수
find mobile/src/screens -name "*.tsx" | wc -l

# 백엔드 API 개수 (v1)
grep -rE "@router\.(get|post|put|patch|delete)" backend/app/api/v1/ | wc -l

# DB 테이블 개수
grep -r "__tablename__" backend/app/models/ | wc -l
```

각 결과가 위 표의 합계(20 / 23 / 11)와 일치하는지 확인하면 됨.

---

## 5. 알려진 갭 (참고)

| 항목 | 상태 | 메모 |
|------|------|------|
| `GET/PATCH/DELETE /users/me` | ❌ 미구현 | `docs/Bridge_API_명세서.md` 에는 정의되어 있으나 `app/api/v1/` 에 라우터 없음 |
| FCM/APNs 푸시 알림 | ❌ 미구현 | 인프라·코드 모두 없음 |
| AWS 배포 | 🟡 진행 중 | Phase 9, `docker-compose.prod.yml` 만 작성된 상태 |

이 갭들은 향후 PDCA 사이클의 후보 항목.
