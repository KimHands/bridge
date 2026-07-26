"""add routines.effort_level (B4 minimal-task track)

Revision ID: f6a8c0d2e4b5
Revises: e5f7a9b1c3d4
Create Date: 2026-07-22

effort_level: 1=최소 부담(무기력·우울 저에너지 트랙 전용), 2=일반.
기존 행은 server_default=2로 채운 뒤, 최소 부담 루틴 title을 1로 설정한다.
(정확한 부담 표기는 이후 seed_routines 재실행으로도 동기화된다.)
"""
from alembic import op
import sqlalchemy as sa

revision = "f6a8c0d2e4b5"
down_revision = "e5f7a9b1c3d4"
branch_labels = None
depends_on = None


MINIMAL_EFFORT_TITLES = (
    "오늘 잘한 일 1가지 적기",
    "물 2L 마시기",
    "취침 전 4-7-8 호흡 5분",
    "오늘 할 일 1가지만 적기",
    "5분 마음 챙김 호흡",
    "오늘 할 수 있는 일 1가지 적기",
    "5분 호흡 명상",
    "물 충분히 마시기",
    "2분 복식호흡",
    "감정 일기 한 줄 작성",
    "물 한 잔 마시기",
    "좋아하는 음악 한 곡 듣기",
)


def upgrade() -> None:
    op.add_column(
        "routines",
        sa.Column(
            "effort_level",
            sa.SmallInteger(),
            nullable=False,
            server_default="2",
        ),
    )
    routines = sa.table(
        "routines",
        sa.column("title", sa.String),
        sa.column("effort_level", sa.SmallInteger),
    )
    op.execute(
        routines.update()
        .where(routines.c.title.in_(MINIMAL_EFFORT_TITLES))
        .values(effort_level=1)
    )


def downgrade() -> None:
    op.drop_column("routines", "effort_level")
