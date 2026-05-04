# [Plan] Phase 5 — routine_trigger.py + 비동기 실행

> 작성일: 2026-04-13
> Phase: 5 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

일기 작성 후 최근 7일 감정 키워드·mood_score를 분석하여 트리거 조건(동일 키워드 3회 이상) 충족 시  
`user_routines`에 `source="trigger"` 루틴을 자동 배정하고 `trigger_logs`에 기록한다.  
트리거는 `POST /diaries` 완료 후 `BackgroundTasks`로 비동기 실행한다.

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 항목 | 설명 |
|---|------|------|
| 1 | `routine_trigger.py` | 트리거 알고리즘 (점수 계산·판정·루틴 배정) |
| 2 | 비동기 실행 연결 | `POST /diaries`에서 `BackgroundTasks`로 트리거 호출 |
| 3 | 쿨다운 확인 | 3일 이내 재발동 방지 (`trigger_logs.cooldown_until`) |
| 4 | `trigger_logs` 기록 | 트리거 발동 이력 저장 |
| 5 | `trigger_executed` 응답 | 실제 트리거 실행 여부를 API 응답에 반영 |

### 제외 (Out of Scope)

- 루틴 관리 API (Phase 6)
- 리포트·미션 집계 (Phase 7·8)
- 푸시 알림 (FCM/APNs)

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 트리거 알고리즘 (`routine_trigger.py`)

#### 발동 조건
- 최근 7일 일기 중 동일 감정 키워드가 **3회 이상** 등장
- 쿨다운: 마지막 트리거 발동 후 **3일** 경과해야 재발동 가능

#### 점수 계산
```
트리거 점수 = mood_score 기여분(30%) + 감정 키워드 기여분(70%)

mood_component    = (5 - mood_avg) / 5 × 0.3
keyword_component = (keyword_freq / total_freq) × 0.7
trigger_score     = mood_component + keyword_component
```

#### 충돌 처리
- 조건 충족 키워드 1개: 해당 키워드 루틴 1개 배정
- 조건 충족 키워드 2개 이상: 점수 상위 2개 키워드 → 각 키워드별 루틴 1개씩 (최대 2개)

#### 루틴 조회 조건
- 사용자 현재 `phq_tier`를 기준으로 `routines` 테이블 조회
  - `phq_tier_min <= tier <= phq_tier_max AND keyword == ANY(target_keywords)` LIMIT 1
- 이미 활성화된 `user_routines`와 중복 시 건너뜀

### 3.2 비동기 실행 구조

```
POST /diaries → create_diary() 응답 반환
                     ↓ (BackgroundTasks.add_task)
              run_trigger(user_id, db_session)  ← 별도 DB 세션 사용
```

- **별도 DB 세션**: Background Task는 요청 scope가 끝나므로 독립 `AsyncSession` 생성
- **응답에 반영**: 트리거가 실제로 발동됐는지 `trigger_executed` 필드로 반환

### 3.3 사용자 PHQ 구간 획득

- `assessments` 테이블에서 최신 `phq_tier` 조회
- 자가평가 기록이 없으면 기본값 tier=2 사용

### 3.4 trigger_logs 저장

```
trigger_logs:
  user_id            UUID
  triggered_keyword  String(20)
  routine_id         Int
  cooldown_until     DateTime  ← now + 3days
```

---

## 4. 쿨다운 확인 로직

```
현재 시각 > trigger_logs.cooldown_until → 발동 가능
현재 시각 ≤ trigger_logs.cooldown_until → 발동 불가 (건너뜀)
```

- 키워드별 독립 쿨다운 (키워드 A의 쿨다운이 키워드 B에 영향 없음)

---

## 5. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | 일기 작성 후 트리거 함수가 BackgroundTask로 실행됨 |
| ☐ | 최근 7일 동일 키워드 3회 미만 → 트리거 미발동 |
| ☐ | 최근 7일 동일 키워드 3회 이상 → user_routines에 source="trigger" 루틴 삽입 |
| ☐ | 쿨다운 3일 내 재발동 시도 → 건너뜀 |
| ☐ | 트리거 발동 후 trigger_logs에 cooldown_until=now+3days 기록 |
| ☐ | POST /diaries 응답의 trigger_executed가 실제 발동 여부 반영 |
| ☐ | 자가평가 없는 사용자: tier=2 기본값 적용 |
| ☐ | 이미 활성 루틴과 중복 시 건너뜀 (중복 배정 없음) |

---

## 6. 구현 순서 (Implementation Order)

```
1. app/routine_trigger.py         — 트리거 알고리즘 (calculate_trigger_score, run_trigger)
2. app/api/v1/diaries.py 수정     — BackgroundTasks 연결, trigger_executed 반영
3. 검증 시나리오 실행
```

---

## 7. 신규/수정 파일

```
backend/app/
└── routine_trigger.py            # 신규: 트리거 알고리즘

# 수정
app/api/v1/diaries.py             # POST /diaries에 BackgroundTasks 추가
```

---

## 8. 의존성

```
# 기존 그대로 — 추가 패키지 없음
app/models/diary.py               # DiaryEntry, diary_emotion_keywords
app/models/keyword.py             # EmotionKeyword
app/models/routine.py             # Routine, UserRoutine
app/models/mission.py             # TriggerLog
app/models/assessment.py          # Assessment (최신 phq_tier 조회)
app/core/database.py              # AsyncSessionLocal (독립 세션)
```

---

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| Background Task DB 세션 오염 | 요청 세션과 별개로 `AsyncSessionLocal()` 컨텍스트 독립 생성 |
| 일기가 7개 미만일 때 | 가용한 일기 전체 사용 (7일 미만이어도 분석 진행) |
| 매칭 루틴 없을 때 | 배정 없이 조용히 종료 (에러 미발생) |
| 트리거 실패 시 일기 작성 롤백 방지 | Background Task 예외는 일기 응답에 영향 없이 로그만 남김 |

---

## 참고 문서

- `docs/Bridge_기능설계_결정문서.md` — C섹션 (트리거 알고리즘)
- `CLAUDE.md` — 트리거 알고리즘 핵심 로직, DB 주요 테이블
