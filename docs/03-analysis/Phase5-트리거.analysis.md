# [Analysis] Phase 5 — routine_trigger.py + 비동기 실행

> 분석일: 2026-04-13
> Phase: 5 / 8
> Match Rate: **97.9%**
> 상태: Check 완료

---

## 비교 대상

| 항목 | 경로 |
|------|------|
| 설계 문서 | `docs/02-design/features/Phase5-트리거.design.md` |
| 트리거 모듈 | `backend/app/routine_trigger.py` |
| 일기 엔드포인트 | `backend/app/api/v1/diaries.py` |
| 루틴 시드 | `backend/app/seeds/routines.py` |

---

## 항목별 Gap 분석 (24개 항목)

| # | 설계 항목 | 구현 | 상태 |
|---|---------|------|------|
| D1 | 디렉토리 구조 (routine_trigger.py 신규 + diaries.py 수정) | 동일 | ✅ |
| D2 | 상수 TRIGGER_THRESHOLD=3, COOLDOWN_DAYS=3, LOOKBACK_DAYS=7 | 동일 | ✅ |
| D3 | Import 목록 12개 (logging, uuid, datetime, sqlalchemy 등) | 동일 | ✅ |
| D4 | `_calculate_trigger_score()` 시그니처 및 반환 타입 | 동일 | ✅ |
| D5 | mood_component = (5-mood_avg)/5×0.3 계산식 | 동일 | ✅ |
| D6 | keyword_component = (freq/total_freq)×0.7 계산식 | 동일 | ✅ |
| D7 | `_evaluate_triggers()` — freq≥THRESHOLD, 점수 내림차순 최대 2개 | 동일 | ✅ |
| D8 | `run_trigger()` — BackgroundTask 진입점, AsyncSessionLocal 독립 세션 | 동일 | ✅ |
| D9 | `run_trigger()` — try/except + logger.exception() | 동일 | ✅ |
| D10 | `_execute_trigger()` ① 최근 7일 DiaryEntry 조회 | 동일 | ✅ |
| D11 | `_execute_trigger()` ② 일기별 EmotionKeyword 수집 (JOIN) | 동일 | ✅ |
| D12 | `_execute_trigger()` ③ 점수 계산 + triggered_keywords 판정 | 동일 | ✅ |
| D13 | `_execute_trigger()` ④ Assessment 최신 phq_tier 조회 (없으면 2) | 동일 | ✅ |
| D14 | `_execute_trigger()` ⑤ 기존 활성 UserRoutine.routine_id 집합 | 동일 | ✅ |
| D15 | `_execute_trigger()` ⑥ 쿨다운 확인 (TriggerLog.cooldown_until > now) | 동일 | ✅ |
| D16 | 루틴 조회 (phq_tier_min≤tier, phq_tier_max≥tier, keyword==any_(target_keywords)) | 동일 | ✅ |
| D17 | UserRoutine(source="trigger", is_active=True) 삽입 | 동일 | ✅ |
| D18 | TriggerLog(cooldown_until=now+3d) 기록 | 동일 | ✅ |
| D19 | active_ids.add(routine.id) — 같은 실행 내 중복 방지 | 동일 | ✅ |
| D20 | any_assigned → db.commit() | 동일 | ✅ |
| D21 | diaries.py — BackgroundTasks import + 파라미터 추가 | 동일 | ✅ |
| D22 | diaries.py — run_trigger import | 동일 | ✅ |
| D23 | diaries.py — background_tasks.add_task(run_trigger, current_user.id) | 동일 | ✅ |
| D24 | diaries.py — trigger_executed=True | 동일 | ✅ |

---

## Gap 목록

### GAP-1 (Info) — diaries.py import 순서 미세 차이

- 설계 원문: `from app.routine_trigger import run_trigger`가 FastAPI import 직후 위치 가정
- 구현: `from app.core.database import get_db` 뒤에 위치 (isort 규칙 준수)
- 영향: 없음 (기능 동일)
- 조치: 현 구현 유지

### GAP-2 (Info) — 루틴 target_keywords 시드 데이터 수정 (설계 문서 미기재)

- 원인: 기존 루틴 `target_keywords`가 영어 원인 카테고리(`sleep`, `academic` 등)만 포함
- 문제: 트리거 알고리즘이 한국어 감정 키워드(`우울한` 등)로 매칭하므로 루틴 미조회
- 조치: `seeds/routines.py` 및 DB 루틴 데이터에 한국어 감정 키워드 추가 (예: `우울한`, `불안한`, `무기력한`, `초조한`, `외로운`, `짜증나는`)
- 영향: 설계 의도에 완전히 부합하는 수정. Phase 5에서 발견하여 즉시 해결.
- 상태: ✅ 해결

---

## 검증 시나리오 결과 (7/7)

| # | 시나리오 | 기대 | 결과 | 상태 |
|---|---------|------|------|------|
| 1 | POST /diaries → trigger_executed 확인 | True | True | ✅ |
| 2 | 동일 키워드(우울한) 3회 이상 → user_routines 삽입 | source="trigger" | 삽입 확인 | ✅ |
| 3 | 쿨다운 중 재발동 시도 | 루틴 미배정 | 미배정 | ✅ |
| 4 | 쿨다운 초기화 후 재발동 | 루틴 재배정 | 재배정 | ✅ |
| 5 | trigger_logs.cooldown_until 확인 | now + 3일 | 2026-04-16 | ✅ |
| 6 | 자가평가 없는 사용자 트리거 | tier=2 기본값 | tier=2 적용 | ✅ |
| 7 | 이미 활성 루틴 → 중복 배정 없음 | 1개 유지 | 1개 유지 | ✅ |

---

## 최종 결과

| 지표 | 값 |
|------|-----|
| 총 비교 항목 | 24 |
| 완전 일치 | 22 |
| Info 불일치 (기능 영향 없음) | 2 (즉시 해결) |
| 검증 시나리오 통과 | 7/7 |
| **Match Rate** | **97.9%** |
