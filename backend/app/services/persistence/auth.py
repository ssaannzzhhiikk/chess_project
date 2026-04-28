from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import settings
from ...persistence_schemas import AuthResponse, UserLogin, UserRead
from .exceptions import InvalidCredentialsError
from .security import verify_password
from .users import get_user_by_email


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def build_auth_response(user: UserRead) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        user=user,
    )


async def authenticate_user(session: AsyncSession, payload: UserLogin) -> UserRead:
    user = await get_user_by_email(session, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise InvalidCredentialsError("Invalid email or password.")
    return UserRead.model_validate(user)
