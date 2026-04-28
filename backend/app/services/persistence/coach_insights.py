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

    insight = CoachInsight(
        game_id=payload.game_id,
        summary=payload.summary,
        mistakes_count=payload.mistakes_count,
        blunders_count=payload.blunders_count,
        best_moves=payload.best_moves,
    )
    session.add(insight)
    await session.flush()
    await session.commit()
    await session.refresh(insight)
    return CoachInsightRead.model_validate(insight)
