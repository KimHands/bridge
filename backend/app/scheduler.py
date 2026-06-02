from calendar import monthrange
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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

KST = ZoneInfo("Asia/Seoul")


async def aggregate_weekly_missions() -> None:
    """매주 월요일 00:05 KST (UTC 일요일 15:05) 전 주 mission_points 집계.

    주차는 반드시 KST 기준으로 계산한다. date.today()(컨테이너 UTC)는 실행 시점이
    UTC 일요일이라 KST 월요일 의도와 어긋나 한 주 밀린다.
    """
    today = datetime.now(KST).date()
    # 전 주 월요일: 오늘(KST 월요일)에서 7일 전
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
    cleanup_stale_tokens_and_logs,
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

# 시나리오 4: 주간 미션 결과 — 월 09:00 KST = UTC 월 00:00.
# (집계는 KST 월 00:05에 돌므로, 발송은 같은 월요일 늦게 돌아 집계 결과를 가리킨다)
scheduler.add_job(
    send_weekly_mission_notifications,
    CronTrigger(day_of_week="mon", hour=0, minute=0, timezone="UTC"),
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

# Hygiene: 매일 03:00 KST = UTC 18:00
scheduler.add_job(
    cleanup_stale_tokens_and_logs,
    CronTrigger(hour=18, minute=0, timezone="UTC"),
    id="notification_cleanup",
    replace_existing=True,
)
