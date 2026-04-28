from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class CoachInsight(Base):
    __tablename__ = "coach_insights"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    game_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("games.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    mistakes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blunders_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_moves: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)

    game: Mapped["Game"] = relationship(back_populates="coach_insights")
