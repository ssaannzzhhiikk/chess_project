from __future__ import annotations

from datetime import UTC, datetime
from unittest import TestCase
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import get_db_session
from app.main import app
from app.middleware.rate_limit import in_memory_rate_limiter
from app.models import Game, User
from app.persistence_schemas import AuthResponse, CoachInsightRead, GameRead, MoveReview, UserRead
from app.services.persistence.auth import create_access_token
from app.services.persistence.exceptions import InvalidCredentialsError


class AuthApiTests(TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.session = AsyncMock()
        in_memory_rate_limiter.reset()

        async def override_get_db_session():
            yield self.session

        app.dependency_overrides[get_db_session] = override_get_db_session

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()
        in_memory_rate_limiter.reset()

    def test_register_returns_token_and_user(self) -> None:
        user = UserRead(
            id=uuid4(),
            email="player@example.com",
            is_pro=False,
            xp=0,
            wins=0,
            created_at=datetime.now(UTC),
        )
        auth_response = AuthResponse(access_token="access-token", user=user)

        with (
            patch("app.api.create_user_service", AsyncMock(return_value=user)),
            patch("app.api.build_auth_response", return_value=auth_response),
        ):
            response = self.client.post(
                "/api/auth/register",
                json={"email": "player@example.com", "password": "secret"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["access_token"], "access-token")
        self.assertEqual(response.json()["token_type"], "bearer")
        self.assertEqual(response.json()["user"]["email"], "player@example.com")

    def test_login_returns_unauthorized_for_invalid_credentials(self) -> None:
        with patch(
            "app.api.authenticate_user",
            AsyncMock(side_effect=InvalidCredentialsError("bad")),
        ):
            response = self.client.post(
                "/api/auth/login",
                json={"email": "player@example.com", "password": "wrong"},
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid email or password")

    def test_login_rate_limit_returns_429(self) -> None:
        user = UserRead(
            id=uuid4(),
            email="player@example.com",
            is_pro=False,
            xp=0,
            wins=0,
            created_at=datetime.now(UTC),
        )
        auth_response = AuthResponse(access_token="access-token", user=user)

        with (
            patch("app.api.authenticate_user", AsyncMock(return_value=user)),
            patch("app.api.build_auth_response", return_value=auth_response),
        ):
            for _ in range(5):
                response = self.client.post(
                    "/api/auth/login",
                    json={"email": "player@example.com", "password": "secret"},
                )
                self.assertEqual(response.status_code, 200)

            rate_limited = self.client.post(
                "/api/auth/login",
                json={"email": "player@example.com", "password": "secret"},
            )

        self.assertEqual(rate_limited.status_code, 429)
        self.assertEqual(rate_limited.json()["detail"], "Too many login attempts. Please try again in a minute.")

    def test_auth_me_returns_current_user(self) -> None:
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = uuid4()
        user.created_at = datetime.now(UTC)
        self.session.get.return_value = user
        token = create_access_token(str(user.id))

        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "player@example.com")

    def test_auth_me_rejects_invalid_token(self) -> None:
        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer not-a-real-token"},
        )

        self.assertEqual(response.status_code, 401)

    def test_create_game_uses_authenticated_user(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        self.session.get.return_value = user
        created_game = GameRead(
            id=uuid4(),
            user_id=user_id,
            pgn="1. e4 e5",
            moves=["e4", "e5"],
            result="draw",
            mode="ai",
            created_at=datetime.now(UTC),
        )

        with patch("app.api.create_game_service", AsyncMock(return_value=created_game)) as create_game_service:
            response = self.client.post(
                "/api/games",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "pgn": "1. e4 e5",
                    "moves": ["e4", "e5"],
                    "result": "draw",
                    "mode": "ai",
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user_id"], str(user_id))
        create_game_service.assert_awaited_once()
        payload = create_game_service.await_args.args[1]
        self.assertEqual(payload.user_id, user_id)
        self.assertEqual(payload.result, "draw")
        self.assertEqual(payload.mode, "ai")

    def test_list_games_returns_authenticated_history(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        self.session.get.return_value = user
        history = [
            GameRead(
                id=uuid4(),
                user_id=user_id,
                pgn="1. d4",
                moves=["d4"],
                result="win",
                mode="multiplayer",
                created_at=datetime.now(UTC),
            )
        ]

        with patch("app.api.get_user_games", AsyncMock(return_value=history)):
            response = self.client.get(
                "/api/games",
                headers={"Authorization": f"Bearer {token}"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["user_id"], str(user_id))

    def test_profile_returns_user_stats_and_recent_games(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=120, wins=2)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        self.session.get.return_value = user

        profile_payload = {
            "user": {
                "id": str(user_id),
                "email": "player@example.com",
                "username": "Player",
                "is_pro": False,
                "xp": 120,
                "wins": 2,
                "level": 2,
                "rating": 1230,
                "created_at": datetime.now(UTC).isoformat(),
            },
            "stats": {
                "total_games": 3,
                "wins": 2,
                "losses": 1,
                "draws": 0,
                "xp": 120,
                "level": 2,
                "rating": 1230,
            },
            "recent_games": [],
        }

        with patch("app.api.get_profile_service", AsyncMock(return_value=profile_payload)):
            response = self.client.get(
                "/api/profile",
                headers={"Authorization": f"Bearer {token}"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "player@example.com")
        self.assertEqual(response.json()["stats"]["wins"], 2)
        self.assertFalse(response.json()["user"]["is_pro"])

    def test_upgrade_marks_user_as_pro(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        self.session.get.return_value = user

        async def refresh_user(refreshed_user: User) -> None:
            refreshed_user.created_at = user.created_at

        self.session.refresh.side_effect = refresh_user

        response = self.client.post(
            "/api/upgrade",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Pro access unlocked")
        self.assertTrue(response.json()["user"]["is_pro"])
        self.assertTrue(user.is_pro)
        self.session.commit.assert_awaited_once()

    def test_analyze_game_requires_authentication(self) -> None:
        response = self.client.post("/api/analyze-game", json={"pgn": "1. e4 e5"})

        self.assertEqual(response.status_code, 401)

    def test_analyze_game_rejects_non_pro_user(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)

        with patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)):
            response = self.client.post(
                "/api/analyze-game",
                headers={"Authorization": f"Bearer {token}"},
                json={"pgn": "1. e4 e5"},
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Pro subscription required")

    def test_analyze_game_saves_insight_for_owned_game(self) -> None:
        user_id = uuid4()
        game_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=True, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        game = Game(user_id=user_id, pgn="1. e4 e5 2. Nf3 Nc6", moves=["e4", "e5", "Nf3", "Nc6"], result="draw", mode="ai")
        game.id = game_id
        self.session.get.side_effect = [user, game]
        saved_insight = CoachInsightRead(
            id=uuid4(),
            game_id=game_id,
            summary="Reviewed 4 moves and found 0 mistake(s).",
            mistakes_count=0,
            blunders_count=0,
            best_moves=["Nf3", "O-O"],
            move_reviews=[
                MoveReview(
                    ply=1,
                    san="e4",
                    best_move="e4",
                    severity="best",
                    evaluation=120,
                    delta=0,
                    summary="e4 is a solid choice here.",
                )
            ],
        )

        with (
            patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)),
            patch("app.api.save_coach_insight", AsyncMock(return_value=saved_insight)) as save_insight,
        ):
            response = self.client.post(
                "/api/analyze-game",
                headers={"Authorization": f"Bearer {token}"},
                json={"game_id": str(game_id)},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["summary"], saved_insight.summary)
        self.assertEqual(response.json()["best_moves"], ["Nf3", "O-O"])
        self.assertEqual(response.json()["move_reviews"][0]["san"], "e4")
        save_insight.assert_awaited_once()

    def test_get_game_analysis_returns_saved_insight_for_owner(self) -> None:
        user_id = uuid4()
        game_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=True, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        game = Game(user_id=user_id, pgn="1. d4 d5", moves=["d4", "d5"], result="win", mode="ai")
        game.id = game_id
        insight = CoachInsightRead(
            id=uuid4(),
            game_id=game_id,
            summary="Stored analysis",
            mistakes_count=1,
            blunders_count=0,
            best_moves=["Nf3"],
            move_reviews=[
                MoveReview(
                    ply=2,
                    san="d5",
                    best_move="Nf3",
                    severity="mistake",
                    evaluation=15,
                    delta=120,
                    summary="d5 misses cleaner development.",
                )
            ],
        )
        self.session.get.side_effect = [user, game]

        with (
            patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)),
            patch("app.api.get_coach_insight_by_game_id", AsyncMock(return_value=insight)),
        ):
            response = self.client.get(
                f"/api/games/{game_id}/analysis",
                headers={"Authorization": f"Bearer {token}"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["game_id"], str(game_id))
        self.assertEqual(response.json()["summary"], "Stored analysis")
        self.assertEqual(response.json()["move_reviews"][0]["ply"], 2)

    def test_get_game_analysis_generates_insight_when_missing(self) -> None:
        user_id = uuid4()
        game_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=True, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        game = Game(
            user_id=user_id,
            pgn="1. e4 e5 2. Qh5 Nc6 3. Qh6 Nxh6 4. Ke2 a5 5. Kf3 a4 6. Ke4 Ng4 7. Kf5 d5#",
            moves=["e4", "e5", "Qh5", "Nc6", "Qh6", "Nxh6", "Ke2", "a5", "Kf3", "a4", "Ke4", "Ng4", "Kf5", "d5#"],
            result="loss",
            mode="ai",
        )
        game.id = game_id
        generated_insight = CoachInsightRead(
            id=uuid4(),
            game_id=game_id,
            summary="Generated analysis",
            mistakes_count=2,
            blunders_count=3,
            best_moves=["d4", "Nf3"],
            move_reviews=[
                MoveReview(
                    ply=3,
                    san="Qh6",
                    best_move="Nf3",
                    severity="blunder",
                    evaluation=-180,
                    delta=240,
                    summary="Qh6 is too ambitious here.",
                )
            ],
        )
        self.session.get.side_effect = [user, game]

        with (
            patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)),
            patch("app.api.get_coach_insight_by_game_id", AsyncMock(return_value=None)),
            patch("app.api.save_coach_insight", AsyncMock(return_value=generated_insight)) as save_insight,
        ):
            response = self.client.get(
                f"/api/games/{game_id}/analysis",
                headers={"Authorization": f"Bearer {token}"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["summary"], "Generated analysis")
        self.assertEqual(response.json()["move_reviews"][0]["san"], "Qh6")
        save_insight.assert_awaited_once()
        payload = save_insight.await_args.args[1]
        self.assertEqual(payload.game_id, game_id)
        self.assertGreaterEqual(payload.blunders_count, 1)
        self.assertGreaterEqual(len(payload.best_moves), 1)
        self.assertGreaterEqual(len(payload.move_reviews), 1)

    def test_analyze_game_rejects_foreign_game_id(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=True, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)
        foreign_game = Game(
            user_id=uuid4(),
            pgn="1. c4 e5",
            moves=["c4", "e5"],
            result="loss",
            mode="multiplayer",
        )
        foreign_game.id = uuid4()
        self.session.get.side_effect = [user, foreign_game]

        with patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)):
            response = self.client.post(
                "/api/analyze-game",
                headers={"Authorization": f"Bearer {token}"},
                json={"game_id": str(foreign_game.id)},
            )

        self.assertEqual(response.status_code, 404)

    def test_coach_explain_rejects_non_pro_user(self) -> None:
        user_id = uuid4()
        token = create_access_token(str(user_id))
        user = User(email="player@example.com", hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = user_id
        user.created_at = datetime.now(UTC)

        with patch("app.middleware.pro_access.resolve_authenticated_user", AsyncMock(return_value=user)):
            response = self.client.post(
                "/api/coach/explain",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "san": "Qh5",
                    "severity": "mistake",
                    "best_move": "Nf3",
                    "evaluation": 20,
                    "delta": 140,
                    "position_context": "Opening: Italian Game",
                },
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Pro subscription required")

    def test_leaderboard_returns_real_entries(self) -> None:
        leaderboard_payload = [
            {
                "username": "Player One",
                "city": "Unknown",
                "rating": 1244,
                "xp": 180,
                "wins": 3,
                "losses": 0,
                "level": 2,
            }
        ]

        with patch("app.api.get_leaderboard", AsyncMock(return_value=leaderboard_payload)):
            response = self.client.get("/api/leaderboard?sort_by=wins&limit=10")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["wins"], 3)
        self.assertEqual(response.json()[0]["xp"], 180)
