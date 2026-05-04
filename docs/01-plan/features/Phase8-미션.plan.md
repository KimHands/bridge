# Plan: Phase8-미션

## 개요

미션 점수 조회 API를 구현한다.
Phase 7에서 APScheduler가 매주 집계·저장한 `mission_points` 데이터를 읽고,
현재 주 실시간 계산 결과를 합산하여 사용자에게 제공한다.

## 목표

- `GET /missions/weekly` — 이번 주 미션 점수 (실시간 집계)
- `GET /missions/total` — 누적 미션 점수 + 주간 이력

## 범위

### 포함

1. **이번 주 미션 점수 API** (`GET /missions/weekly`)
   - `week_start`: 오늘 기준 이번 주 월요일
   - `routine_days`: 이번 주 루틴 완료 날 수 (`routine_logs` DISTINCT `completed_date`)
   - `diary_days`: 이번 주 일기 작성 날 수 (`diary_entries` DISTINCT `recorded_date`)
   - `weekly_score`: `round(routine_days/7*70) + round(diary_days/7*30)`
   - `total_score`: 역대 달성 주 합산 + 이번 주 score
   - `is_achieved`: `routine_days >= 3 AND diary_days >= 3`
   - `week_year`: ISO 주차 형식 `"2026-W15"`

2. **누적 점수 조회 API** (`GET /missions/total`)
   - `total_score`: 역대 달성(is_achieved) 주 점수 합계
   - `weekly_history`: `mission_points` 전체 기록 (week_year, weekly_score, is_achieved)
   - 역대 `is_achieved` 계산: `routine_score >= 30 AND diary_score >= 13` (3일 기준 역산)

### 제외

- 미션 달성 Push 알림
- 리더보드 / 소셜 기능
- `mission_points` 스키마 변경 (routine_days, diary_days 컬럼 추가)

## 사용 모델·테이블

| 테이블 | 역할 |
|--------|------|
| `mission_points` | 역대 주간 점수 기록 (Phase 7 배치로 저장됨) |
| `routine_logs` | 이번 주 루틴 달성 날 수 집계 |
| `user_routines` | 루틴-유저 연결 (routine_logs JOIN) |
| `diary_entries` | 이번 주 일기 작성 날 수 집계 |

## 구현 파일 목록

```
backend/app/
├── schemas/mission.py    # Pydantic 스키마 3종
├── api/v1/missions.py    # 2개 엔드포인트
└── main.py               # missions 라우터 등록
```

## 핵심 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 이번 주 데이터 처리 | 매번 실시간 쿼리 | 배치는 주 종료 후 월요일에 실행 → 현재 주는 항상 live 계산 필요 |
| 역대 is_achieved 판별 | `routine_score >= 30 AND diary_score >= 13` | mission_points에 days 컬럼 없음; 3일 기준 역산 공식 적용 |
| total_score 산정 | 달성 주(`is_achieved=True`)만 합산 | PRD: "미달성 시 해당 주 적립 안 됨" |
| week_year 포맷 | `f"{iso_year}-W{iso_week:02d}"` | ISO 8601 표준; `date.isocalendar()` 활용 |

## 완료 기준

- [ ] `GET /missions/weekly`: 응답 스키마 100% 일치
- [ ] `GET /missions/total`: 응답 스키마 100% 일치
- [ ] 신규 사용자(mission_points 없음): 정상 응답 (`weekly_score: 0, total_score: 0`)
- [ ] `is_achieved` 분기: `routine_days >= 3 AND diary_days >= 3` 기준 정확히 반영
- [ ] `main.py` missions 라우터 등록 확인

## 참고 문서

- `docs/Bridge_PRD.md` — 섹션 10 긍정 미션 시스템
- `docs/Bridge_API_명세서.md` — 섹션 9 미션 포인트
