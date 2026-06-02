"""add hot-path indexes and routine_logs unique constraint

핫패스 인덱스(trigger_logs·user_routines·assessments) + routine_logs 중복 완료
방어용 (user_routine_id, completed_date) 유니크 제약. 적대적 검증 E1·E2.

Revision ID: b2c4d6e8f0a1
Revises: 5a1e5afb8492
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b2c4d6e8f0a1'
down_revision: Union[str, None] = '5a1e5afb8492'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # E1: 핫패스 복합 인덱스 (PG는 FK 자동 인덱스 미생성)
    op.create_index(
        "ix_trigger_logs_user_keyword_created",
        "trigger_logs",
        ["user_id", "triggered_keyword", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_user_routines_user_active",
        "user_routines",
        ["user_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "ix_assessments_user_created",
        "assessments",
        ["user_id", "created_at"],
        unique=False,
    )
    # E2: 하루 한 사용자루틴당 완료 로그 1건 — 동시 더블탭 race를 DB 레벨에서 방어.
    #     (user_routine_id, completed_date) 조회 인덱스도 겸한다.
    op.create_unique_constraint(
        "uq_routine_log_user_date",
        "routine_logs",
        ["user_routine_id", "completed_date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_routine_log_user_date", "routine_logs", type_="unique")
    op.drop_index("ix_assessments_user_created", table_name="assessments")
    op.drop_index("ix_user_routines_user_active", table_name="user_routines")
    op.drop_index("ix_trigger_logs_user_keyword_created", table_name="trigger_logs")
