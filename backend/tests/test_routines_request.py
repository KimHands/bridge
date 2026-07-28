# backend/tests/test_routines_request.py
"""POST /routines/request 핸들러 단위 테스트.

Routine.target_keywords가 Postgres ARRAY라 select_on_demand_routine 내부
쿼리는 SQLite로 돌릴 수 없다 — 여기서는 라우터 핸들러의 분기 로직(레이트리밋 상태
→ 응답 상태·계측 매핑)만 협력자를 monkeypatch로 대체해 검증한다.
전체 경로(DB에 실제 배정 기록, 쿨다운, 429 하드캡)는 라이브 컨테이너 E2E로 검증
(task-4-report.md 참조).
"""
import uuid

import pytest

from app.api.v1 import routines as routines_module
from app.services.notification import assert_domain_safe
from app.services.request_rate_limiter import RateState
from app.services.trigger_metrics import (
    REQUEST_ABUSE,
    REQUEST_COOLDOWN,
    REQUEST_ESCALATION_OFFERED,
    REQUEST_FIRED,
    REQUEST_NO_ROUTINE,
)


class _FakeRoutine:
    def __init__(self, id=7, title="복식호흡", description="천천히 숨을 들이쉬고 내쉬어요"):
        self.id = id
        self.title = title
        self.description = description


class _FakeUser:
    def __init__(self):
        self.id = uuid.uuid4()


class _FakeDB:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


async def _async(value):
    return value


def _patch_common(monkeypatch, *, rate_state, tier=2, active_ids=None, routine=None, recorded=None):
    monkeypatch.setattr(routines_module, "get_redis", lambda: _async(object()))
    monkeypatch.setattr(
        routines_module, "check_and_count", lambda r, uid: _async(rate_state)
    )
    monkeypatch.setattr(routines_module, "_latest_tier", lambda db, uid: _async(tier))
    monkeypatch.setattr(
        routines_module, "_active_routine_ids", lambda db, uid: _async(active_ids or set())
    )
    monkeypatch.setattr(
        routines_module, "select_on_demand_routine",
        lambda db, uid, t, ids: _async(routine),
    )

    if recorded is None:
        recorded = []

    async def fake_record(outcome):
        recorded.append(outcome)

    monkeypatch.setattr(routines_module, "record_trigger_decision", fake_record)
    return recorded


@pytest.mark.asyncio
async def test_assigned_state_records_fired_and_persists_source_request(monkeypatch):
    recorded = []
    routine = _FakeRoutine(id=7)
    _patch_common(
        monkeypatch,
        rate_state=RateState(allowed_new=True, reason="allow", nudge=False, offer_connection=False),
        routine=routine,
        recorded=recorded,
    )
    db = _FakeDB()
    user = _FakeUser()

    resp = await routines_module.request_routine(current_user=user, db=db)

    assert resp["success"] is True
    assert resp["data"].state == "assigned"
    assert resp["data"].assigned is not None
    assert resp["data"].assigned.routine_id == 7
    assert resp["data"].offer_connection is False
    assert db.committed is True
    assert len(db.added) == 1
    assert db.added[0].source == "request"
    assert db.added[0].user_id == user.id
    assert db.added[0].routine_id == 7
    assert db.added[0].is_active is True
    assert recorded == [REQUEST_FIRED]


@pytest.mark.asyncio
async def test_assigned_state_with_offer_connection_records_escalation_offered(monkeypatch):
    recorded = []
    routine = _FakeRoutine(id=9)
    _patch_common(
        monkeypatch,
        rate_state=RateState(allowed_new=True, reason="allow", nudge=True, offer_connection=True),
        routine=routine,
        recorded=recorded,
    )
    db = _FakeDB()
    user = _FakeUser()

    resp = await routines_module.request_routine(current_user=user, db=db)

    assert resp["data"].state == "assigned"
    assert resp["data"].offer_connection is True
    assert resp["data"].nudge is True
    assert recorded == [REQUEST_ESCALATION_OFFERED]


@pytest.mark.asyncio
async def test_cooldown_state_blocks_assignment_and_records_cooldown(monkeypatch):
    recorded = []
    _patch_common(
        monkeypatch,
        rate_state=RateState(allowed_new=False, reason="cooldown", nudge=True, offer_connection=False),
        recorded=recorded,
    )
    db = _FakeDB()
    user = _FakeUser()

    resp = await routines_module.request_routine(current_user=user, db=db)

    assert resp["data"].state == "cooldown"
    assert resp["data"].assigned is None
    assert resp["data"].nudge is True
    assert db.committed is False
    assert db.added == []
    assert recorded == [REQUEST_COOLDOWN]


@pytest.mark.asyncio
async def test_no_routine_state_when_selector_returns_none(monkeypatch):
    recorded = []
    _patch_common(
        monkeypatch,
        rate_state=RateState(allowed_new=True, reason="allow", nudge=False, offer_connection=False),
        routine=None,
        recorded=recorded,
    )
    db = _FakeDB()
    user = _FakeUser()

    resp = await routines_module.request_routine(current_user=user, db=db)

    assert resp["data"].state == "no_routine"
    assert resp["data"].assigned is None
    assert db.committed is False
    assert recorded == [REQUEST_NO_ROUTINE]


@pytest.mark.asyncio
async def test_abuse_reason_raises_429_and_records_abuse(monkeypatch):
    recorded = []
    _patch_common(
        monkeypatch,
        rate_state=RateState(allowed_new=False, reason="abuse"),
        recorded=recorded,
    )
    db = _FakeDB()
    user = _FakeUser()

    with pytest.raises(Exception) as exc_info:
        await routines_module.request_routine(current_user=user, db=db)

    # fastapi.HTTPException
    assert getattr(exc_info.value, "status_code", None) == 429
    assert db.committed is False
    assert recorded == [REQUEST_ABUSE]


def test_request_path_messages_are_domain_safe():
    """치료/진단/개선/효과 등 도메인 금지어 미포함 확인 (CLAUDE.md 규제 표현 가이드)."""
    assert_domain_safe(routines_module._MSG_REQUEST_COOLDOWN)
    assert_domain_safe(routines_module._MSG_REQUEST_NO_ROUTINE)
    assert_domain_safe(routines_module._MSG_REQUEST_ASSIGNED)
