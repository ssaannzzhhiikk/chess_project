from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_create_persistence_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "games",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pgn", sa.Text(), nullable=False),
        sa.Column("moves", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("mode IN ('ai', 'multiplayer')", name=op.f("ck_games_mode_valid")),
        sa.CheckConstraint("result IN ('win', 'loss', 'draw')", name=op.f("ck_games_result_valid")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_games_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_games")),
    )
    op.create_index(op.f("ix_games_user_id"), "games", ["user_id"], unique=False)

    op.create_table(
        "achievements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_achievements_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_achievements")),
    )
    op.create_index(op.f("ix_achievements_user_id"), "achievements", ["user_id"], unique=False)

    op.create_table(
        "coach_insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("mistakes_count", sa.Integer(), nullable=False),
        sa.Column("blunders_count", sa.Integer(), nullable=False),
        sa.Column("best_moves", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["games.id"],
            name=op.f("fk_coach_insights_game_id_games"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_coach_insights")),
    )
    op.create_index(op.f("ix_coach_insights_game_id"), "coach_insights", ["game_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_coach_insights_game_id"), table_name="coach_insights")
    op.drop_table("coach_insights")
    op.drop_index(op.f("ix_achievements_user_id"), table_name="achievements")
    op.drop_table("achievements")
    op.drop_index(op.f("ix_games_user_id"), table_name="games")
    op.drop_table("games")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
