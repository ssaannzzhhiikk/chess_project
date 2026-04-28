from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest import TestCase
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.db import get_db_session
from app.main import app
from app.models import Game, User
from app.services.multiplayer import room_manager
from app.services.persistence.auth import create_access_token


class MultiplayerApiTests(TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.session = AsyncMock()
        self.session.add = Mock()
        self.users: dict = {}

        async def session_get(model, object_id):
            if model is User:
                return self.users.get(object_id)
            return None

        async def refresh(entity) -> None:
            if isinstance(entity, Game):
                entity.id = uuid4()
                entity.created_at = datetime.now(UTC)

        self.session.get.side_effect = session_get
        self.session.refresh.side_effect = refresh

        async def override_get_db_session():
            yield self.session

        app.dependency_overrides[get_db_session] = override_get_db_session
        asyncio.run(room_manager.reset())

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()
        asyncio.run(room_manager.reset())

    def create_user_and_token(self, email: str) -> tuple[User, str]:
        user = User(email=email, hashed_password="stored-hash", is_pro=False, xp=0, wins=0)
        user.id = uuid4()
        user.created_at = datetime.now(UTC)
        self.users[user.id] = user
        return user, create_access_token(str(user.id))

    def auth_headers(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_create_room_assigns_creator_as_white(self) -> None:
        user, token = self.create_user_and_token("white@example.com")

        response = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["white_player_id"], str(user.id))
        self.assertIsNone(payload["black_player_id"])
        self.assertEqual(payload["status"], "waiting")
        self.assertEqual(payload["assigned_color"], "white")
        self.assertEqual(payload["moves"], [])

    def test_join_room_assigns_black_player(self) -> None:
        _, white_token = self.create_user_and_token("white@example.com")
        black_user, black_token = self.create_user_and_token("black@example.com")

        create_response = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(white_token),
        )
        room_id = create_response.json()["room_id"]

        join_response = self.client.post(
            f"/api/multiplayer/rooms/{room_id}/join",
            headers=self.auth_headers(black_token),
        )

        self.assertEqual(join_response.status_code, 200)
        payload = join_response.json()
        self.assertEqual(payload["black_player_id"], str(black_user.id))
        self.assertEqual(payload["status"], "active")
        self.assertEqual(payload["assigned_color"], "black")

    def test_join_room_rejects_third_player(self) -> None:
        _, white_token = self.create_user_and_token("white@example.com")
        _, black_token = self.create_user_and_token("black@example.com")
        _, extra_token = self.create_user_and_token("extra@example.com")

        room_id = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(white_token),
        ).json()["room_id"]
        self.client.post(
            f"/api/multiplayer/rooms/{room_id}/join",
            headers=self.auth_headers(black_token),
        )

        response = self.client.post(
            f"/api/multiplayer/rooms/{room_id}/join",
            headers=self.auth_headers(extra_token),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Room is full")

    def test_websocket_rejects_unauthenticated_connections(self) -> None:
        _, white_token = self.create_user_and_token("white@example.com")
        room_id = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(white_token),
        ).json()["room_id"]

        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect(f"/api/ws/games/{room_id}"):
                pass

    def test_websocket_rejects_wrong_turn_and_illegal_move(self) -> None:
        _, white_token = self.create_user_and_token("white@example.com")
        _, black_token = self.create_user_and_token("black@example.com")

        room_id = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(white_token),
        ).json()["room_id"]
        self.client.post(
            f"/api/multiplayer/rooms/{room_id}/join",
            headers=self.auth_headers(black_token),
        )

        with (
            self.client.websocket_connect(f"/api/ws/games/{room_id}?token={white_token}") as white_socket,
            self.client.websocket_connect(f"/api/ws/games/{room_id}?token={black_token}") as black_socket,
        ):
            white_socket.receive_json()
            black_socket.receive_json()

            black_socket.send_json({"type": "move", "source": "e7", "target": "e5"})
            wrong_turn = black_socket.receive_json()
            self.assertEqual(wrong_turn["type"], "error")
            self.assertEqual(wrong_turn["message"], "It is not your turn.")

            white_socket.send_json({"type": "move", "source": "e2", "target": "e5"})
            illegal_move = white_socket.receive_json()
            self.assertEqual(illegal_move["type"], "error")
            self.assertEqual(illegal_move["message"], "Illegal move.")

    def test_reconnect_restores_room_state(self) -> None:
        _, white_token = self.create_user_and_token("white@example.com")
        _, black_token = self.create_user_and_token("black@example.com")

        room_id = self.client.post(
            "/api/multiplayer/rooms",
            headers=self.auth_headers(white_token),
        ).json()["room_id"]
        self.client.post(
            f"/api/multiplayer/rooms/{room_id}/join",
            headers=self.auth_headers(black_token),
        )

        with (
            self.client.websocket_connect(f"/api/ws/games/{room_id}?token={white_token}") as white_socket,
            self.client.websocket_connect(f"/api/ws/games/{room_id}?token={black_token}") as black_socket,
        ):
            white_socket.receive_json()
            black_socket.receive_json()

            white_socket.send_json({"type": "move", "source": "e2", "target": "e4"})
            white_state = white_socket.receive_json()
            black_state = black_socket.receive_json()

            self.assertEqual(white_state["room"]["moves"], ["e4"])
            self.assertEqual(black_state["room"]["moves"], ["e4"])

            black_socket.close()

        with self.client.websocket_connect(f"/api/ws/games/{room_id}?token={black_token}") as reconnected_black:
            restored = reconnected_black.receive_json()
            self.assertEqual(restored["room"]["assigned_color"], "black")
            self.assertEqual(restored["room"]["moves"], ["e4"])
            self.assertEqual(restored["room"]["status"], "active")
