# Design: Phase7-리포트

## 아키텍처 결정

- APScheduler를 FastAPI lifespan에 연결해 Docker 재시작 시 자동 등록
- 리포트 API는 ON-DEMAND 집계 (캐시 없음, 데이터 적어 DB 집계로 충분)
- 배치 잡은 scheduler.py 단일 파일로 분리 (main.py 의존성 최소화)

---

## 파일 구조

```
backend/app/
├── schemas/report.py      # 응답 스키마
├── api/v1/reports.py      # 3개 엔드포인트
├── scheduler.py           # APScheduler + 배치 잡
└── main.py                # lifespan에 스케줄러 추가
```

---

## 스키마 설계 (`schemas/report.py`)

```python
from datetime import date
from typing import Optional
from pydantic import BaseModel

# 주간 리포트
class WeeklyReportData(BaseModel):
    week_start: date
    week_end: date
    routine_completion_rate: float        # 소수점 1자리, 0~100
    mood_average: Optional[float]         # 일기 없으면 null
    mood_scores: list[Optional[int]]      # 7개 배열, 미기록 null
    top_emotion_keywords: list[str]       # 최대 3개
    top_situation_keywords: list[str]     # 최대 3개
    diary_count: int

# 월간 리포트
class MoodPoint(BaseModel):
    date: date
    mood_score: int

class MonthlyReportData(BaseModel):
    year: int
    month: int
    routine_completion_rate: float
    mood_average: Optional[float]
    mood_trend: list[MoodPoint]
    emotion_keyword_distribution: dict[str, int]
    diary_count: int

# 감정 추이
class MoodTrendData(BaseModel):
    trend: list[MoodPoint]
```

---

## API 설계 (`api/v1/reports.py`)

### GET /reports/weekly

```
Query: date (optional, YYYY-MM-DD, 기본값=today)
Auth: Bearer JWT
```

**집계 로직**

```python
# 1. 주 범위 계산 (월요일~일요일)
week_start = date - timedelta(days=date.weekday())  # 해당 주 월요일
week_end = week_start + timedelta(days=6)

# 2. 일기 조회 (diary_entries WHERE recorded_date BETWEEN week_start AND week_end)
# 3. mood_scores: 7개 슬롯, recorded_date 기준 매핑
mood_scores = [None] * 7
for entry in diaries:
    idx = (entry.recorded_date - week_start).days
    mood_scores[idx] = entry.mood_score

# 4. mood_average: sum / len (일기 있는 경우만)
# 5. routine_completion_rate:
#    - routine_logs WHERE completed_date BETWEEN week_start AND week_end
#    - 활성 user_routines 수 기준 계산
#    routine_days = len(distinct completed_dates)
#    rate = (routine_days / 7) * 100  ← 7일 기준
# 6. top_emotion_keywords: diary_emotion_keywords → emotion_keywords.name 빈도순 TOP 3
# 7. top_situation_keywords: situation_keywords.answer_text 빈도순 TOP 3
```

### GET /reports/monthly

```
Query: year (int), month (int), 기본값=현재 연월
```

**집계 로직**

```python
# 1. 해당 월 첫날~마지막날
from calendar import monthrange
_, last_day = monthrange(year, month)
month_start = date(year, month, 1)
month_end = date(year, month, last_day)

# 2. diary_entries WHERE recorded_date BETWEEN month_start AND month_end
# 3. mood_trend: [(date, mood_score), ...] 기록된 날만
# 4. emotion_keyword_distribution: 전체 감정 키워드 빈도 딕셔너리
# 5. routine_completion_rate: distinct completed_dates 수 / last_day * 100
```

### GET /reports/mood-trend

```
Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
유효성: from <= to, 최대 범위 90일 (초과 시 400)
```

---

## 스케줄러 설계 (`scheduler.py`)

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="UTC")

async def aggregate_weekly_missions():
    """매주 월요일 00:05 KST (UTC 일요일 15:05) 전 주 집계"""
    # 1. 전 주 week_start (지난 월요일)
    # 2. 모든 user 대상 순회
    # 3. routine_score: 해당 주 distinct completed_dates 수 / 7 * 70
    # 4. diary_score: 해당 주 diary_entries 수 / 7 * 30
    # 5. total_score = routine_score + diary_score
    # 6. mission_points INSERT ... ON CONFLICT (user_id, week_start) DO UPDATE

scheduler.add_job(
    aggregate_weekly_missions,
    CronTrigger(day_of_week="sun", hour=15, minute=5, timezone="UTC"),
)
```

---

## main.py 수정

```python
from app.scheduler import scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await seed_emotion_keywords(db)
        await seed_routines(db)
    scheduler.start()
    yield
    scheduler.shutdown()
```

---

## 에러 응답

| 상황 | HTTP | error.code |
|------|------|-----------|
| date 쿼리 형식 오류 | 422 | INVALID_DATE_FORMAT |
| from > to | 400 | INVALID_DATE_RANGE |
| 범위 90일 초과 | 400 | DATE_RANGE_TOO_LARGE |
| year/month 범위 오류 | 422 | INVALID_YEAR_MONTH |

---

## requirements.txt 추가

```
apscheduler>=3.10,<4.0
```

---

## 구현 순서

1. `requirements.txt` — apscheduler 추가
2. `schemas/report.py` — 스키마 3종
3. `api/v1/reports.py` — 3개 엔드포인트 (weekly → monthly → mood-trend 순)
4. `scheduler.py` — AsyncIOScheduler + aggregate_weekly_missions
5. `main.py` — reports 라우터 등록 + lifespan 수정
6. Docker 재빌드 후 /docs 확인
