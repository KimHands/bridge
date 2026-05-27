from calendar import monthrange
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.models.diary import DiaryEntry
from app.models.mission import MissionPoint
from app.models.routine import RoutineLog, UserRoutine
from app.models.user import User

scheduler = AsyncIOScheduler(timezone="UTC")


async def aggregate_weekly_missions() -> None:
    """매주 월요일 00:05 KST (UTC 일요일 15:05) 전 주 mission_points 집계."""
    today = date.today()
    # 전 주 월요일: 오늘(월요일)에서 7일 전
    week_start = today - timedelta(days=today.weekday() + 7)
    week_end = week_start + timedelta(days=6)

    async with AsyncSessionLocal() as db:
        user_rows = await db.execute(select(User.id))
        user_ids = user_rows.scalars().all()

        for user_id in user_ids:
            # 루틴 달성 일수
            rl_rows = await db.execute(
                select(RoutineLog.completed_date)
                .join(UserRoutine, RoutineLog.user_routine_id == UserRoutine.id)
                .where(
                    UserRoutine.user_id == user_id,
                    RoutineLog.completed_date >= week_start,
                    RoutineLog.completed_date <= week_end,
                )
                .distinct()
            )
            routine_days = len(rl_rows.scalars().all())

            # 일기 작성 일수
            de_rows = await db.execute(
                select(DiaryEntry.recorded_date).where(
                    DiaryEntry.user_id == user_id,
                    DiaryEntry.recorded_date >= week_start,
                    DiaryEntry.recorded_date <= week_end,
                )
            )
            diary_days = len(de_rows.scalars().all())

            routine_score = round(routine_days / 7 * 70)
            diary_score = round(diary_days / 7 * 30)
            total_score = routine_score + diary_score

            stmt = (
                pg_insert(MissionPoint)
                .values(
                    user_id=user_id,
                    week_start=week_start,
                    routine_score=routine_score,
                    diary_score=diary_score,
                    total_score=total_score,
                )
                .on_conflict_do_update(
                    index_elements=["user_id", "week_start"],
                    set_={
                        "routine_score": routine_score,
                        "diary_score": diary_score,
                        "total_score": total_score,
                    },
                )
            )
            await db.execute(stmt)

        await db.commit()


# UTC 일요일 15:05 = KST 월요일 00:05
scheduler.add_job(
    aggregate_weekly_missions,
    CronTrigger(day_of_week="sun", hour=15, minute=5, timezone="UTC"),
    id="weekly_mission_aggregate",
    replace_existing=True,
)

from app.services.notification import (  # noqa: E402
    send_assessment_reminders,
    send_diary_nudges,
    send_routine_reminders,
    send_weekly_mission_notifications,
)

# 시나리오 2: 일기 미작성 — 매일 21:00 KST = UTC 12:00
scheduler.add_job(
    send_diary_nudges,
    CronTrigger(hour=12, minute=0, timezone="UTC"),
    id="diary_nudge",
    replace_existing=True,
)

# 시나리오 1: 루틴 리마인더 — 매 5분
scheduler.add_job(
    send_routine_reminders,
    CronTrigger(minute="*/5", timezone="UTC"),
    id="routine_reminder",
    replace_existing=True,
)

# 시나리오 4: 주간 미션 결과 — 월 09:00 KST = UTC 일 00:00
scheduler.add_job(
    send_weekly_mission_notifications,
    CronTrigger(day_of_week="sun", hour=0, minute=0, timezone="UTC"),
    id="weekly_mission_notification",
    replace_existing=True,
)

# 시나리오 5: 자가평가 리마인더 — 매일 10:00 KST = UTC 01:00
scheduler.add_job(
    send_assessment_reminders,
    CronTrigger(hour=1, minute=0, timezone="UTC"),
    id="assessment_reminder",
    replace_existing=True,
)
