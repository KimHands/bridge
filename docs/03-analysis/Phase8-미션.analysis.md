# Gap Analysis: Phase8-미션

## 분석 개요

| 항목 | 내용 |
|------|------|
| 분석 대상 | Phase 8 — 미션 점수 조회 API |
| 설계 문서 | `docs/02-design/features/Phase8-미션.design.md` |
| 계획 문서 | `docs/01-plan/features/Phase8-미션.plan.md` |
| 구현 경로 | `backend/app/{schemas/mission.py, api/v1/missions.py, main.py}` |
| 분석 일자 | 2026-04-27 |

---

## 종합 점수

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| 스키마 일치도 | 100% | ✅ |
| API 동작 일치도 | 100% | ✅ |
| 라우터 등록 | 95% | ✅ |
| 컨벤션 / 아키텍처 준수 | 100% | ✅ |
| **종합 Match Rate** | **99%** | ✅ |

---

## 항목별 상세 분석

### 1. 스키마 (`schemas/mission.py`)

| 클래스 | 설계 필드 | 결과 |
|--------|-----------|:----:|
| `WeeklyMissionData` | week_year, routine_days, diary_days, weekly_score, total_score, is_achieved | ✅ |
| `WeeklyHistoryItem` | week_year, weekly_score, is_achieved | ✅ |
| `TotalMissionData` | total_score, weekly_history | ✅ |

### 2. GET /missions/weekly

| 검증 포인트 | 결과 |
|-------------|:----:|
| week_start = today - timedelta(days=today.weekday()) | ✅ |
| routine_days: RoutineLog JOIN UserRoutine DISTINCT | ✅ |
| diary_days: DiaryEntry recorded_date BETWEEN | ✅ |
| weekly_score = round(r/7*70) + round(d/7*30) | ✅ |
| is_achieved = routine_days>=3 AND diary_days>=3 | ✅ |
| historical_total: routine_score>=30 AND diary_score>=13 | ✅ |
| total_score = historical + (weekly_score if is_achieved else 0) | ✅ |
| week_year = ISO 8601 포맷 | ✅ |

### 3. GET /missions/total

| 검증 포인트 | 결과 |
|-------------|:----:|
| ORDER BY week_start ASC | ✅ |
| is_achieved 역산: routine_score>=30 AND diary_score>=13 | ✅ |
| total_score: 달성 주만 합산 | ✅ |
| 빈 데이터 응답: total_score:0, weekly_history:[] | ✅ |

### 4. main.py 라우터 등록

| 검증 포인트 | 결과 |
|-------------|:----:|
| missions_router import | ✅ |
| include_router 등록 (최종 URL 동일) | ✅ |

---

## 발견된 차이점

### 누락 (설계 O, 구현 X)
없음.

### 추가 (설계 X, 구현 O) — 품질 개선

| 항목 | 위치 | 설명 |
|------|------|------|
| 상수 추출 | `missions.py:19-20` | `_ACHIEVE_ROUTINE_MIN=30`, `_ACHIEVE_DIARY_MIN=13` — 인라인 매직 넘버 제거 |
| 헬퍼 함수 추출 | `missions.py:23-25` | `_iso_week_year()` — 두 엔드포인트 중복 제거 |

### 변경 (설계 ≠ 구현) — 의도적, 영향 없음

| 항목 | 설계 | 구현 | 영향도 |
|------|------|------|:------:|
| 라우터 prefix 분배 | main.py에서 `/v1/missions` 일괄 | 라우터에 `/missions`, main.py에 `/v1` 분리 | 없음 (최종 경로 동일, 프로젝트 패턴 일치) |

---

## 완료 기준 체크리스트

- [x] `GET /missions/weekly`: 응답 스키마 100% 일치
- [x] `GET /missions/total`: 응답 스키마 100% 일치
- [x] 신규 사용자(mission_points 없음): `weekly_score:0, total_score:0` 정상 반환
- [x] `is_achieved` 분기: `routine_days >= 3 AND diary_days >= 3` 정확 반영
- [x] `main.py` missions 라우터 등록 확인

---

## 결론

**Match Rate: 99%** — 모든 설계 명세를 충족. 구현에서 추가된 상수·헬퍼 추출은 품질 개선 방향이며 Gap이 아님. Act(iterate) 단계 없이 바로 `/pdca report Phase8-미션`으로 진행 가능.
