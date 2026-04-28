from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0005_move_reviews"
down_revision = "0004_create_multiplayer_games"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "coach_insights",
        sa.Column(
            "move_reviews",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.alter_column("coach_insights", "move_reviews", server_default=None)


def downgrade() -> None:
    op.drop_column("coach_insights", "move_reviews")
