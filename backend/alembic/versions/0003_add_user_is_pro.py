from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_add_user_is_pro"
down_revision = "0002_add_user_xp_and_wins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_pro", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "is_pro")
