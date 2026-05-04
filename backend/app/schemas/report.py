from datetime import date
from typing import Optional

from pydantic import BaseModel


class MoodPoint(BaseModel):
    date: date
    mood_score: int


class WeeklyReportData(BaseModel):
    week_start: date
    week_end: date
    routine_completion_rate: float
    mood_average: Optional[float]
    mood_scores: list[Optional[int]]
    top_emotion_keywords: list[str]
    top_situation_keywords: list[str]
    diary_count: int


class MonthlyReportData(BaseModel):
    year: int
    month: int
    routine_completion_rate: float
    mood_average: Optional[float]
    mood_trend: list[MoodPoint]
    emotion_keyword_distribution: dict[str, int]
    diary_count: int


class MoodTrendData(BaseModel):
    trend: list[MoodPoint]
