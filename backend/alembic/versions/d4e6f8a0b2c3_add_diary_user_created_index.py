"""add diary_entries(user_id, created_at) hot-path index

트리거(routine_trigger)는 일기 POST마다 user_id + created_at>=lookback 를 조회하고,
일기 목록은 user_id로 created_at DESC 페이지네이션한다. 기존 인덱스
uq_diary_user_date는 recorded_date 기준이라 이 경로를 커버하지 못한다(M7).

Revision ID: d4e6f8a0b2c3
Revises: c3d5e7f9a1b2
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd4e6f8a0b2c3'
down_revision: Union[str, None] = 'c3d5e7f9a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_diary_entries_user_created",
        "diary_entries",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_diary_entries_user_created", table_name="diary_entries")
