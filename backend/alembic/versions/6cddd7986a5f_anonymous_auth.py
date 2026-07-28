"""anonymous-first auth: users 익명 필드 추가 (B6 Task 1)

Revision ID: 6cddd7986a5f
Revises: f6a8c0d2e4b5
Create Date: 2026-07-29

email_hash/password_hash를 nullable로 전환하고 is_anonymous·device_secret_hash·
email_verified를 추가한다. 기존 사용자(email_hash 있음)는 백필로
is_anonymous=false, email_verified=true 처리된다.
"""
from alembic import op
import sqlalchemy as sa

revision = "6cddd7986a5f"
down_revision = "f6a8c0d2e4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column("users", sa.Column("device_secret_hash", sa.String(64), nullable=True))
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_unique_constraint("uq_users_device_secret_hash", "users", ["device_secret_hash"])
    op.alter_column("users", "email_hash", existing_type=sa.String(64), nullable=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(60), nullable=True)
    # 기존 사용자 백필: 이메일 있는 계정은 비익명·인증됨
    op.execute("UPDATE users SET is_anonymous=false, email_verified=true WHERE email_hash IS NOT NULL")


def downgrade() -> None:
    op.drop_constraint("uq_users_device_secret_hash", "users", type_="unique")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "device_secret_hash")
    op.drop_column("users", "is_anonymous")
    op.alter_column("users", "password_hash", existing_type=sa.String(60), nullable=False)
    op.alter_column("users", "email_hash", existing_type=sa.String(64), nullable=False)
