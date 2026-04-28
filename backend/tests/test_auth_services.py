from __future__ import annotations

from datetime import UTC, datetime
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.models import User
from app.persistence_schemas import UserLogin
from app.services.persistence.auth import authenticate_user
from app.services.persistence.exceptions import InvalidCredentialsError


class AuthenticateUserServiceTests(IsolatedAsyncioTestCase):
    async def test_authenticate_user_returns_user_on_valid_password(self) -> None:
        session = AsyncMock()
        user = User(email="player@example.com", hashed_password="stored-hash", xp=0, wins=0)
        user.id = uuid4()
        user.created_at = datetime.now(UTC)

        with (
            patch("app.services.persistence.auth.get_user_by_email", AsyncMock(return_value=user)),
            patch("app.services.persistence.auth.verify_password", return_value=True),
        ):
            authenticated_user = await authenticate_user(
                session,
                UserLogin(email="player@example.com", password="secret"),
            )

        self.assertEqual(authenticated_user.email, "player@example.com")
        self.assertEqual(authenticated_user.id, user.id)

    async def test_authenticate_user_rejects_invalid_password(self) -> None:
        session = AsyncMock()
        user = User(email="player@example.com", hashed_password="stored-hash", xp=0, wins=0)
        user.id = uuid4()
        user.created_at = datetime.now(UTC)

        with (
            patch("app.services.persistence.auth.get_user_by_email", AsyncMock(return_value=user)),
            patch("app.services.persistence.auth.verify_password", return_value=False),
        ):
            with self.assertRaises(InvalidCredentialsError):
                await authenticate_user(
                    session,
                    UserLogin(email="player@example.com", password="wrong"),
                )
