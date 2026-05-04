from pydantic import BaseModel


class WeeklyMissionData(BaseModel):
    week_year: str
    routine_days: int
    diary_days: int
    weekly_score: int
    total_score: int
    is_achieved: bool


class WeeklyHistoryItem(BaseModel):
    week_year: str
    weekly_score: int
    is_achieved: bool


class TotalMissionData(BaseModel):
    total_score: int
    weekly_history: list[WeeklyHistoryItem]
