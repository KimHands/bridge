# backend/tests/test_notification_scheduling.py
from datetime import date as _date, datetime, time
from zoneinfo import ZoneInfo

from app.services.notification import is_assessment_due, is_within_reminder_window

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


def test_assessment_due_exactly_8_weeks():
    last = _date(2026, 4, 1)
    today = _date(2026, 5, 27)  # 56 days later
    assert is_assessment_due(last, today) is True


def test_assessment_not_due_7_weeks():
    last = _date(2026, 4, 8)
    today = _date(2026, 5, 27)  # 49 days later
    assert is_assessment_due(last, today) is False


def test_assessment_due_overdue():
    last = _date(2026, 1, 1)
    today = _date(2026, 5, 27)
    assert is_assessment_due(last, today) is True
