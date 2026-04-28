from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_add_user_xp_and_wins"
down_revision = "0001_create_persistence_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("xp", sa.Integer(), server_default=sa.text("0"), nullable=False))
    op.add_column("users", sa.Column("wins", sa.Integer(), server_default=sa.text("0"), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "wins")
    op.drop_column("users", "xp")
