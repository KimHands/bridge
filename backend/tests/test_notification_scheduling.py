# backend/tests/test_notification_scheduling.py
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.services.notification import is_within_reminder_window

KST = ZoneInfo("Asia/Seoul")


def test_within_window_exact_match():
    now = datetime(2026, 5, 27, 9, 0, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is True


def test_within_window_plus_2_minutes():
    now = datetime(2026, 5, 27, 9, 2, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is True


def test_outside_window_5_minutes():
    now = datetime(2026, 5, 27, 9, 5, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is False


def test_midnight_boundary():
    now = datetime(2026, 5, 27, 23, 59, 0, tzinfo=KST)
    assert is_within_reminder_window(time(0, 0), now) is True
