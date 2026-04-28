from __future__ import annotations

from datetime import UTC, datetime
from unittest import TestCase
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import get_db_session
from app.main import app
from app.models import User
from app.persistence_schemas import AuthResponse, GameRead, UserRead
from app.services.persistence.auth import create_access_token
from app.services.persistence.exceptions import InvalidCredentialsError


class AuthApiTests(TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.session = AsyncMock()

        async def override_get_db_session():
            yield self.session

        app.dependency_overrides[get_db_session] = override_get_db_session

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_register_returns_token_and_user(self) -> None:
        user = UserRead(
            id=uuid4(),
            email="player@example.com",
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

    def test_auth_me_returns_current_user(self) -> None:
        user = User(email="player@example.com", hashed_password="stored-hash")
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
        user = User(email="player@example.com", hashed_password="stored-hash")
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
        user = User(email="player@example.com", hashed_password="stored-hash")
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
