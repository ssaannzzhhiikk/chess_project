from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        CheckConstraint("result IN ('win', 'loss', 'draw')", name="result_valid"),
        CheckConstraint("mode IN ('ai', 'multiplayer')", name="mode_valid"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pgn: Mapped[str] = mapped_column(Text, nullable=False)
    moves: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    result: Mapped[str] = mapped_column(String(16), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="games")
    coach_insights: Mapped[list["CoachInsight"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
