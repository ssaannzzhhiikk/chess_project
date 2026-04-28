from __future__ import annotations

from datetime import UTC, datetime
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from app.models import Game, User
from app.persistence_schemas import CoachInsightCreate, GameCreate, UserCreate
from app.services.persistence.exceptions import DuplicateEmailError, EntityNotFoundError
from app.services.persistence.games import create_game, get_user_games
from app.services.persistence.coach_insights import save_coach_insight
from app.services.persistence.users import create_user


class CreateUserServiceTests(IsolatedAsyncioTestCase):
    async def test_create_user_hashes_password(self) -> None:
        session = AsyncMock()
        session.add = Mock()
        session.scalar.return_value = None

        async def refresh_user(user: User) -> None:
            user.id = uuid4()
            user.created_at = datetime.now(UTC)

        session.refresh.side_effect = refresh_user

        with patch("app.services.persistence.users.hash_password", return_value="hashed-password"):
            created_user = await create_user(
                session,
                UserCreate(email="player@example.com", password="secret"),
            )

        self.assertEqual(created_user.email, "player@example.com")
        self.assertIsNotNone(created_user.id)
        session.add.assert_called_once()
        session.flush.assert_awaited_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    async def test_create_user_rejects_duplicate_email(self) -> None:
        session = AsyncMock()
        session.scalar.return_value = uuid4()

        with self.assertRaises(DuplicateEmailError):
            await create_user(session, UserCreate(email="player@example.com", password="secret"))


class GameServiceTests(IsolatedAsyncioTestCase):
    async def test_create_game_requires_existing_user(self) -> None:
        session = AsyncMock()
        session.get.return_value = None

        with self.assertRaises(EntityNotFoundError):
            await create_game(
                session,
                GameCreate(
                    user_id=uuid4(),
                    pgn="",
                    moves=[],
                    result="draw",
                    mode="ai",
                ),
            )

    async def test_get_user_games_returns_newest_first(self) -> None:
        session = AsyncMock()
        user_id = uuid4()
        older_game = Game(
            user_id=user_id,
            pgn="1. e4",
            moves=["e4"],
            result="win",
            mode="ai",
        )
        older_game.id = uuid4()
        older_game.created_at = datetime(2024, 1, 1, tzinfo=UTC)
        newer_game = Game(
            user_id=user_id,
            pgn="1. d4",
            moves=["d4"],
            result="loss",
            mode="multiplayer",
        )
        newer_game.id = uuid4()
        newer_game.created_at = datetime(2024, 1, 2, tzinfo=UTC)

        scalars_result = Mock()
        scalars_result.all.return_value = [newer_game, older_game]
        session.scalars.return_value = scalars_result

        games = await get_user_games(session, user_id)

        self.assertEqual([game.pgn for game in games], ["1. d4", "1. e4"])


class CoachInsightServiceTests(IsolatedAsyncioTestCase):
    async def test_save_coach_insight_requires_existing_game(self) -> None:
        session = AsyncMock()
        session.get.return_value = None

        with self.assertRaises(EntityNotFoundError):
            await save_coach_insight(
                session,
                CoachInsightCreate(
                    game_id=uuid4(),
                    summary="Missed tactic",
                    mistakes_count=1,
                    blunders_count=0,
                    best_moves=["Qh5+"],
                ),
            )

    async def test_save_coach_insight_persists_record(self) -> None:
        session = AsyncMock()
        session.add = Mock()
        game = Game(
            user_id=uuid4(),
            pgn="1. e4 e5",
            moves=["e4", "e5"],
            result="draw",
            mode="ai",
        )
        session.get.return_value = game

        async def refresh_insight(insight) -> None:
            insight.id = uuid4()

        session.refresh.side_effect = refresh_insight

        insight = await save_coach_insight(
            session,
            CoachInsightCreate(
                game_id=uuid4(),
                summary="Watch the back rank.",
                mistakes_count=2,
                blunders_count=1,
                best_moves=["Re8"],
            ),
        )

        self.assertEqual(insight.summary, "Watch the back rank.")
        session.add.assert_called_once()
        session.flush.assert_awaited_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()
