from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import Game, User
from ...persistence_schemas import (
    GameRead,
    LeaderboardEntryRead,
    LeaderboardSort,
    ProfileRead,
    ProfileStatsRead,
    ProfileUserRead,
)


def build_username(email: str) -> str:
    local_part = email.split("@", 1)[0]
    segments = [segment for segment in local_part.replace(".", " ").replace("_", " ").split() if segment]
    if not segments:
        return "Player"
    return " ".join(segment[:1].upper() + segment[1:] for segment in segments)


def calculate_level(xp: int) -> int:
    return max(1, xp // 120 + 1)


def calculate_rating(wins: int, xp: int) -> int:
    return 1200 + wins * 14 + (xp // 120) * 2


def to_leaderboard_entry(user: User) -> LeaderboardEntryRead:
    return LeaderboardEntryRead(
        username=build_username(user.email),
        city="Unknown",
        rating=calculate_rating(user.wins, user.xp),
        xp=user.xp,
        wins=user.wins,
        losses=0,
        level=calculate_level(user.xp),
    )


async def get_leaderboard(
    session: AsyncSession,
    sort_by: LeaderboardSort = "xp",
    limit: int = 20,
) -> list[LeaderboardEntryRead]:
    order_by = (
        [desc(User.wins), desc(User.xp), User.created_at]
        if sort_by == "wins"
        else [desc(User.xp), desc(User.wins), User.created_at]
    )
    result = await session.scalars(select(User).order_by(*order_by).limit(limit))
    return [to_leaderboard_entry(user) for user in result.all()]


async def get_profile(session: AsyncSession, user_id: UUID) -> ProfileRead | None:
    user = await session.get(User, user_id)
    if user is None:
        return None

    recent_result = await session.scalars(
        select(Game)
        .where(Game.user_id == user_id)
        .order_by(Game.created_at.desc())
        .limit(5)
    )
    recent_games = recent_result.all()

    all_games_result = await session.scalars(select(Game.result).where(Game.user_id == user_id))
    all_results = all_games_result.all()
    losses = sum(1 for result in all_results if result == "loss")
    draws = sum(1 for result in all_results if result == "draw")

    level = calculate_level(user.xp)
    rating = calculate_rating(user.wins, user.xp)

    return ProfileRead(
        user=ProfileUserRead(
            id=user.id,
            email=user.email,
            username=build_username(user.email),
            xp=user.xp,
            wins=user.wins,
            level=level,
            rating=rating,
            created_at=user.created_at,
        ),
        stats=ProfileStatsRead(
            total_games=len(all_results),
            wins=user.wins,
            losses=losses,
            draws=draws,
            xp=user.xp,
            level=level,
            rating=rating,
        ),
        recent_games=[GameRead.model_validate(game) for game in recent_games],
    )
