from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_create_multiplayer_games"
down_revision = "0003_add_user_is_pro"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "multiplayer_games",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("white_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("black_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("winner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("pgn", sa.Text(), nullable=False),
        sa.Column("moves", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("result IN ('white', 'black', 'draw')", name=op.f("ck_multiplayer_games_result_valid")),
        sa.ForeignKeyConstraint(
            ["black_user_id"],
            ["users.id"],
            name=op.f("fk_multiplayer_games_black_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["white_user_id"],
            ["users.id"],
            name=op.f("fk_multiplayer_games_white_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["winner_user_id"],
            ["users.id"],
            name=op.f("fk_multiplayer_games_winner_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_multiplayer_games")),
    )
    op.create_index(op.f("ix_multiplayer_games_black_user_id"), "multiplayer_games", ["black_user_id"], unique=False)
    op.create_index(op.f("ix_multiplayer_games_white_user_id"), "multiplayer_games", ["white_user_id"], unique=False)
    op.create_index(op.f("ix_multiplayer_games_winner_user_id"), "multiplayer_games", ["winner_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_multiplayer_games_winner_user_id"), table_name="multiplayer_games")
    op.drop_index(op.f("ix_multiplayer_games_white_user_id"), table_name="multiplayer_games")
    op.drop_index(op.f("ix_multiplayer_games_black_user_id"), table_name="multiplayer_games")
    op.drop_table("multiplayer_games")
