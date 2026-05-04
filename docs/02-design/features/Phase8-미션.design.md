# Design: Phase8-미션

## 아키텍처 결정

- 미션 API는 ON-DEMAND 조회 (캐시 없음, 사용자당 데이터 양이 적어 DB 집계로 충분)
- 이번 주 데이터는 항상 실시간 쿼리 (배치는 전 주 기준으로만 실행)
- `is_achieved` 역산 공식: `routine_score >= 30 AND diary_score >= 13` (3일 기준)
- `total_score`는 달성한 주(`is_achieved=True`)의 점수만 합산 (PRD 10.3)

---

## 파일 구조

```
backend/app/
├── schemas/mission.py    # 응답 스키마 3종
├── api/v1/missions.py    # 2개 엔드포인트
└── main.py               # missions 라우터 등록
```

---

## 스키마 설계 (`schemas/mission.py`)

```python
from pydantic import BaseModel


class WeeklyMissionData(BaseModel):
    week_year: str       # "2026-W15" (ISO 8601)
    routine_days: int    # 이번 주 루틴 완료 날 수 (0~7)
    diary_days: int      # 이번 주 일기 작성 날 수 (0~7)
    weekly_score: int    # round(routine_days/7*70) + round(diary_days/7*30)
    total_score: int     # 달성 주 누적 합산 + 이번 주 기여분
    is_achieved: bool    # routine_days >= 3 AND diary_days >= 3


class WeeklyHistoryItem(BaseModel):
    week_year: str       # "2026-W14"
    weekly_score: int    # 해당 주 총점
    is_achieved: bool    # 역산: routine_score >= 30 AND diary_score >= 13


class TotalMissionData(BaseModel):
    total_score: int
    weekly_history: list[WeeklyHistoryItem]  # week_start ASC 정렬
```

---

## API 설계 (`api/v1/missions.py`)

### GET /missions/weekly

```
인증: Bearer JWT 필요
Query: 없음
```

**집계 로직**

```python
from datetime import date, timedelta

today = date.today()
week_start = today - timedelta(days=today.weekday())   # 이번 주 월요일
week_end   = week_start + timedelta(days=6)

# 1. routine_days: 이번 주 루틴 완료 DISTINCT 날짜 수
#    SELECT DISTINCT completed_date FROM routine_logs
#    JOIN user_routines ON ... WHERE user_id = ? AND completed_date BETWEEN week_start AND week_end
routine_days = len(distinct_completed_dates)

# 2. diary_days: 이번 주 일기 작성 DISTINCT 날짜 수
#    SELECT recorded_date FROM diary_entries
#    WHERE user_id = ? AND recorded_date BETWEEN week_start AND week_end
diary_days = len(diary_recorded_dates)

# 3. 점수 계산
weekly_score = round(routine_days / 7 * 70) + round(diary_days / 7 * 30)
is_achieved  = routine_days >= 3 and diary_days >= 3

# 4. 역대 달성 주 합산 (mission_points)
#    SELECT SUM(total_score) FROM mission_points
#    WHERE user_id = ? AND routine_score >= 30 AND diary_score >= 13
historical_total = sum(achieved mission_points.total_score)
total_score = historical_total + (weekly_score if is_achieved else 0)

# 5. week_year
iso = week_start.isocalendar()
week_year = f"{iso[0]}-W{iso[1]:02d}"
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "week_year": "2026-W18",
    "routine_days": 4,
    "diary_days": 3,
    "weekly_score": 57,
    "total_score": 312,
    "is_achieved": true
  }
}
```

---

### GET /missions/total

```
인증: Bearer JWT 필요
Query: 없음
```

**집계 로직**

```python
# 1. 해당 유저 mission_points 전체 조회 (week_start ASC)
#    SELECT * FROM mission_points WHERE user_id = ? ORDER BY week_start ASC
all_points = [...]

# 2. 각 행 처리
total_score    = 0
weekly_history = []

for mp in all_points:
    is_achieved = mp.routine_score >= 30 and mp.diary_score >= 13
    if is_achieved:
        total_score += mp.total_score

    iso       = mp.week_start.isocalendar()
    week_year = f"{iso[0]}-W{iso[1]:02d}"
    weekly_history.append(WeeklyHistoryItem(
        week_year    = week_year,
        weekly_score = mp.total_score,
        is_achieved  = is_achieved,
    ))
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "total_score": 312,
    "weekly_history": [
      {"week_year": "2026-W14", "weekly_score": 85, "is_achieved": true},
      {"week_year": "2026-W15", "weekly_score": 57, "is_achieved": true}
    ]
  }
}
```

---

## 에러 응답

| 상황 | HTTP | 처리 |
|------|------|------|
| 인증 토큰 없음/만료 | 401 | 공통 auth dependency 처리 |
| mission_points 없음 (신규 사용자) | 200 | `total_score: 0, weekly_history: []` 정상 반환 |

---

## main.py 수정

```python
from app.api.v1 import missions

# 라우터 등록
app.include_router(missions.router, prefix="/v1/missions", tags=["missions"])
```

---

## is_achieved 역산 공식 근거

```
routine_days >= 3  →  routine_score = round(3 / 7 * 70) = round(30.0) = 30
diary_days   >= 3  →  diary_score   = round(3 / 7 * 30) = round(12.857) = 13

∴ is_achieved ≡ (routine_score >= 30) AND (diary_score >= 13)
```

---

## 구현 순서

1. `schemas/mission.py` — 스키마 3종
2. `api/v1/missions.py` — GET /weekly → GET /total 순 구현
3. `main.py` — missions 라우터 등록
4. Docker 재빌드 후 `/docs` 확인
