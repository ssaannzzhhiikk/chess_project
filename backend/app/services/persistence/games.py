from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import Game, User
from ...persistence_schemas import GameCreate, GameRead
from .exceptions import EntityNotFoundError


async def create_game(session: AsyncSession, payload: GameCreate) -> GameRead:
    user = await session.get(User, payload.user_id)
    if user is None:
        raise EntityNotFoundError(f"User '{payload.user_id}' was not found.")

    game = Game(
        user_id=payload.user_id,
        pgn=payload.pgn,
        moves=payload.moves,
        result=payload.result,
        mode=payload.mode,
    )
    session.add(game)
    await session.flush()
    await session.commit()
    await session.refresh(game)
    return GameRead.model_validate(game)


async def get_user_games(session: AsyncSession, user_id: UUID) -> list[GameRead]:
    result = await session.scalars(
        select(Game)
        .where(Game.user_id == user_id)
        .order_by(Game.created_at.desc())
    )
    games = result.all()
    return [GameRead.model_validate(game) for game in games]
