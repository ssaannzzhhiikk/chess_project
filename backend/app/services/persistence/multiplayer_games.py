from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import MultiplayerGame, User
from ...persistence_schemas import MultiplayerGameCreate, MultiplayerGameRead
from .exceptions import EntityNotFoundError


async def create_multiplayer_game(session: AsyncSession, payload: MultiplayerGameCreate) -> MultiplayerGameRead:
    white_user = await session.get(User, payload.white_user_id)
    if white_user is None:
        raise EntityNotFoundError(f"User '{payload.white_user_id}' was not found.")

    black_user = await session.get(User, payload.black_user_id)
    if black_user is None:
        raise EntityNotFoundError(f"User '{payload.black_user_id}' was not found.")

    if payload.winner_user_id is not None:
        winner_user = await session.get(User, payload.winner_user_id)
        if winner_user is None:
            raise EntityNotFoundError(f"User '{payload.winner_user_id}' was not found.")
        if payload.winner_user_id not in {payload.white_user_id, payload.black_user_id}:
            raise EntityNotFoundError("Winner must be one of the room participants.")

    game = MultiplayerGame(
        white_user_id=payload.white_user_id,
        black_user_id=payload.black_user_id,
        winner_user_id=payload.winner_user_id,
        result=payload.result,
        pgn=payload.pgn,
        moves=list(payload.moves),
    )
    session.add(game)
    await session.flush()
    await session.commit()
    await session.refresh(game)
    return MultiplayerGameRead.model_validate(game)


async def get_user_multiplayer_games(session: AsyncSession, user_id: UUID) -> list[MultiplayerGameRead]:
    result = await session.scalars(
        select(MultiplayerGame)
        .where(or_(MultiplayerGame.white_user_id == user_id, MultiplayerGame.black_user_id == user_id))
        .order_by(MultiplayerGame.created_at.desc())
    )
    games = result.all()
    return [MultiplayerGameRead.model_validate(game) for game in games]


async def get_user_multiplayer_game(
    session: AsyncSession,
    user_id: UUID,
    game_id: UUID,
) -> MultiplayerGameRead | None:
    result = await session.scalar(
        select(MultiplayerGame).where(
            MultiplayerGame.id == game_id,
            or_(MultiplayerGame.white_user_id == user_id, MultiplayerGame.black_user_id == user_id),
        )
    )
    if result is None:
        return None
    return MultiplayerGameRead.model_validate(result)
