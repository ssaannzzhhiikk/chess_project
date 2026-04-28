from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import CoachInsight, Game
from ...persistence_schemas import CoachInsightCreate, CoachInsightRead
from .exceptions import EntityNotFoundError


async def save_coach_insight(
    session: AsyncSession,
    payload: CoachInsightCreate,
) -> CoachInsightRead:
    game = await session.get(Game, payload.game_id)
    if game is None:
        raise EntityNotFoundError(f"Game '{payload.game_id}' was not found.")

    insight = await session.scalar(select(CoachInsight).where(CoachInsight.game_id == payload.game_id))
    if insight is None:
        insight = CoachInsight(
            game_id=payload.game_id,
            summary=payload.summary,
            mistakes_count=payload.mistakes_count,
            blunders_count=payload.blunders_count,
            best_moves=payload.best_moves,
        )
        session.add(insight)
    else:
        insight.summary = payload.summary
        insight.mistakes_count = payload.mistakes_count
        insight.blunders_count = payload.blunders_count
        insight.best_moves = payload.best_moves

    await session.flush()
    await session.commit()
    await session.refresh(insight)
    return CoachInsightRead.model_validate(insight)


async def get_coach_insight_by_game_id(session: AsyncSession, game_id: UUID) -> CoachInsightRead | None:
    insight = await session.scalar(select(CoachInsight).where(CoachInsight.game_id == game_id))
    if insight is None:
        return None
    return CoachInsightRead.model_validate(insight)
