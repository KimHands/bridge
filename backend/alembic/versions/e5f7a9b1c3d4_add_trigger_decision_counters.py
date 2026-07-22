"""add trigger_decision_counters

무발동(provide nothing)을 포함한 트리거 결정 분포를 익명 사전집계로 관측한다.
user_id를 저장하지 않는다.

Revision ID: e5f7a9b1c3d4
Revises: d4e6f8a0b2c3
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'e5f7a9b1c3d4'
down_revision: Union[str, None] = 'd4e6f8a0b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trigger_decision_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("outcome", sa.String(length=40), nullable=False),
        sa.Column("day_bucket", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("outcome", "day_bucket", name="uq_trigger_outcome_day"),
    )


def downgrade() -> None:
    op.drop_table("trigger_decision_counters")
