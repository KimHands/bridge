# [Design] Phase 5 — routine_trigger.py + 비동기 실행

> 작성일: 2026-04-13
> Phase: 5 / 8
> 상태: Design (⚠️ **일부 대체됨 2026-07-21** — 점수 계산부 `_calculate_trigger_score`의 mood 가중합은
> no-op(R1)으로 폐기되고 게이트 체인 설계로 대체됨: `docs/02-design/2026-07-21-트리거-재설계.design.md`.
> 본 문서는 Phase 5 시점 기록으로 보존한다.)
> 참조: `docs/01-plan/features/Phase5-트리거.plan.md`

---

## 1. 디렉토리 구조 (추가분)

```
backend/app/
└── routine_trigger.py          # 신규: 트리거 알고리즘 전체

# 수정
app/api/v1/diaries.py           # POST /diaries에 BackgroundTasks 연결
```

---

## 2. `routine_trigger.py` 전체 설계

### 2.1 상수 정의

```python
TRIGGER_THRESHOLD = 3     # 발동 조건: 동일 키워드 N회 이상
COOLDOWN_DAYS = 3         # 쿨다운 기간(일)
LOOKBACK_DAYS = 7         # 분석 기간(일)
```

### 2.2 Import 목록

```python
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword
from app.models.mission import TriggerLog
from app.models.routine import Routine, UserRoutine
```

### 2.3 `_calculate_trigger_score()` — 점수 계산

```python
def _calculate_trigger_score(
    diary_logs: list[dict],
) -> tuple[dict[str, float], dict[str, int]]:
    """
    diary_logs: [{"mood_score": int, "emotion_keywords": [str]}]
    Returns: (trigger_scores, keyword_freq)
    """
    if not diary_logs:
        return {}, {}

    keyword_freq: dict[str, int] = {}
    mood_sum = 0

    for log in diary_logs:
        mood_sum += log["mood_score"]
        for keyword in log["emotion_keywords"]:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1

    mood_avg = mood_sum / len(diary_logs)
    total_freq = sum(keyword_freq.values())

    trigger_scores: dict[str, float] = {}
    for keyword, freq in keyword_freq.items():
        mood_component = (5 - mood_avg) / 5 * 0.3
        keyword_component = (freq / total_freq) * 0.7
        trigger_scores[keyword] = mood_component + keyword_component

    return trigger_scores, keyword_freq
```

### 2.4 `_evaluate_triggers()` — 발동 키워드 판정

```python
def _evaluate_triggers(
    trigger_scores: dict[str, float],
    keyword_freq: dict[str, int],
) -> list[str]:
    """
    TRIGGER_THRESHOLD 이상인 키워드를 점수 내림차순으로 최대 2개 반환.
    """
    triggered = [k for k, freq in keyword_freq.items() if freq >= TRIGGER_THRESHOLD]
    if not triggered:
        return []
    return sorted(triggered, key=lambda k: trigger_scores.get(k, 0), reverse=True)[:2]
```

### 2.5 `run_trigger()` — 공개 진입점 (BackgroundTask용)

```python
async def run_trigger(user_id: uuid.UUID) -> None:
    """
    BackgroundTasks.add_task(run_trigger, user_id) 로 호출.
    독립 DB 세션 생성 — 요청 세션과 격리.
    """
    try:
        async with AsyncSessionLocal() as db:
            await _execute_trigger(user_id, db)
    except Exception:
        logger.exception("Trigger execution failed for user_id=%s", user_id)
```

### 2.6 `_execute_trigger()` — 트리거 핵심 로직

```python
async def _execute_trigger(user_id: uuid.UUID, db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=LOOKBACK_DAYS)

    # ① 최근 7일 일기 조회
    diary_result = await db.execute(
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id, DiaryEntry.created_at >= lookback)
        .order_by(DiaryEntry.created_at.asc())
    )
    diaries = diary_result.scalars().all()
    if not diaries:
        return

    # ② 일기별 감정 키워드 수집
    diary_logs = []
    for diary in diaries:
        kw_result = await db.execute(
            select(EmotionKeyword)
            .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
            .where(DiaryEmotionKeyword.diary_id == diary.id)
        )
        kw_names = [kw.name for kw in kw_result.scalars().all()]
        diary_logs.append({"mood_score": diary.mood_score, "emotion_keywords": kw_names})

    # ③ 트리거 점수 계산 + 발동 키워드 판정
    trigger_scores, keyword_freq = _calculate_trigger_score(diary_logs)
    triggered_keywords = _evaluate_triggers(trigger_scores, keyword_freq)
    if not triggered_keywords:
        return

    # ④ 최신 PHQ 구간 조회 (없으면 기본값 2)
    assess_result = await db.execute(
        select(Assessment)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    latest = assess_result.scalar_one_or_none()
    phq_tier = latest.phq_tier if latest else 2

    # ⑤ 기존 활성 루틴 id 집합
    active_result = await db.execute(
        select(UserRoutine.routine_id)
        .where(UserRoutine.user_id == user_id, UserRoutine.is_active == True)
    )
    active_ids = {row[0] for row in active_result.all()}

    # ⑥ 키워드별 쿨다운 확인 + 루틴 배정
    any_assigned = False
    for keyword in triggered_keywords:
        # 쿨다운 확인
        cd_result = await db.execute(
            select(TriggerLog)
            .where(TriggerLog.user_id == user_id, TriggerLog.triggered_keyword == keyword)
            .order_by(TriggerLog.created_at.desc())
            .limit(1)
        )
        last_log = cd_result.scalar_one_or_none()
        if last_log and last_log.cooldown_until > now:
            continue  # 쿨다운 중 → 건너뜀

        # 루틴 조회 (tier 범위 + 키워드 매칭, 중복 제외)
        routine_result = await db.execute(
            select(Routine)
            .where(
                Routine.phq_tier_min <= phq_tier,
                Routine.phq_tier_max >= phq_tier,
                keyword == any_(Routine.target_keywords),
            )
            .limit(1)
        )
        routine = routine_result.scalar_one_or_none()
        if not routine or routine.id in active_ids:
            continue  # 매칭 루틴 없거나 이미 활성 중

        # UserRoutine 삽입
        db.add(UserRoutine(
            user_id=user_id,
            routine_id=routine.id,
            source="trigger",
            is_active=True,
            assigned_at=now,
        ))

        # TriggerLog 기록
        db.add(TriggerLog(
            user_id=user_id,
            triggered_keyword=keyword,
            routine_id=routine.id,
            cooldown_until=now + timedelta(days=COOLDOWN_DAYS),
        ))

        active_ids.add(routine.id)  # 같은 트리거 실행 내 중복 방지
        any_assigned = True

    if any_assigned:
        await db.commit()
```

---

## 3. `diaries.py` 수정 — BackgroundTasks 연결

### 3.1 수정 포인트

```python
# 추가 import
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.routine_trigger import run_trigger

# create_diary 시그니처 수정
@router.post("", status_code=201, response_model=SuccessResponse[DiaryCreateResponse])
async def create_diary(
    body: DiaryCreateRequest,
    background_tasks: BackgroundTasks,               # 추가
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ...
    await db.commit()
    await db.refresh(diary)

    # 트리거 비동기 등록 (응답 반환 후 실행)
    background_tasks.add_task(run_trigger, current_user.id)

    return {
        "success": True,
        "data": DiaryCreateResponse(
            ...
            trigger_executed=True,   # BackgroundTask 등록 = 트리거 실행 예정
        ),
        ...
    }
```

### 3.2 `trigger_executed` 의미 정의

| 값 | 의미 |
|----|------|
| `True` | 트리거 알고리즘이 스케줄됨 (BackgroundTask 등록 완료) |
| (현재 False 없음) | 일기 작성 시 항상 True — 실제 루틴 배정 여부와 무관 |

> 실제 루틴 배정 여부는 트리거 내부에서 조용히 처리 (에러 없이 종료).  
> 클라이언트는 `trigger_executed=True` 를 "백그라운드에서 분석이 실행됐음"으로 해석.

---

## 4. 실행 흐름 다이어그램

```
POST /diaries
    │
    ├─ DiaryEntry 저장
    ├─ keyword 저장
    ├─ await db.commit()
    ├─ background_tasks.add_task(run_trigger, user_id)
    └─ HTTP 201 응답 반환 (trigger_executed=True)

[Background]
    run_trigger(user_id)
        │
        ├─ AsyncSessionLocal() 독립 세션 생성
        └─ _execute_trigger(user_id, db)
               │
               ├─ 최근 7일 DiaryEntry 조회
               ├─ 감정 키워드 수집
               ├─ _calculate_trigger_score()
               ├─ _evaluate_triggers()
               ├─ phq_tier 조회 (없으면 2)
               ├─ 활성 루틴 id 집합 확보
               └─ 키워드별 루프:
                     ├─ 쿨다운 확인
                     ├─ 루틴 조회
                     ├─ UserRoutine(source="trigger") 삽입
                     └─ TriggerLog(cooldown_until=now+3d) 기록
```

---

## 5. 쿨다운 및 중복 방지 규칙

| 규칙 | 구현 |
|------|------|
| 키워드별 쿨다운 3일 | `TriggerLog.cooldown_until > now` 시 건너뜀 |
| 이미 활성 루틴 배정 방지 | `active_ids` 집합으로 `routine.id` 확인 |
| 같은 실행 내 중복 방지 | 배정 후 `active_ids.add(routine.id)` |
| 매칭 루틴 없을 때 | 조용히 건너뜀 (예외 없음) |
| 트리거 전체 실패 | `logger.exception()` 로 로깅, 일기 응답에 영향 없음 |

---

## 6. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | 동일 키워드 3회 미만 일기 → POST /diaries | trigger_executed=True, 루틴 미배정 |
| 2 | 동일 키워드 3회 이상 일기 → POST /diaries | trigger_executed=True, user_routines에 source="trigger" 삽입 |
| 3 | 시나리오 2 직후 같은 키워드 재발동 시도 | 쿨다운으로 루틴 미배정 |
| 4 | 쿨다운 3일 경과 후 재발동 | 루틴 재배정 가능 |
| 5 | trigger_logs 저장 확인 | cooldown_until = now + 3일 |
| 6 | 자가평가 없는 사용자 트리거 | tier=2 기본값으로 루틴 조회 |
| 7 | 이미 활성화된 루틴 → 중복 배정 없음 | user_routines 중복 없음 |

---

## 7. 구현 순서 (체크리스트)

```
[ ] 1. app/routine_trigger.py  (상수, 함수 4개)
[ ] 2. app/api/v1/diaries.py 수정  (BackgroundTasks import + 파라미터 + add_task)
[ ] 3. 검증 시나리오 실행
```
