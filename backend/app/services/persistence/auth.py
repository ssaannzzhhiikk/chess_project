from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import settings
from ...models import User
from ...persistence_schemas import AuthResponse, UserLogin, UserRead
from .exceptions import InvalidCredentialsError
from .security import verify_password
from .users import get_user_by_email, get_user_by_id


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token_subject(token: str) -> UUID | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if subject is None:
            return None
        return UUID(subject)
    except (JWTError, ValueError):
        return None


async def resolve_user_from_access_token(session: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None

    user_id = decode_access_token_subject(token)
    if user_id is None:
        return None

    return await get_user_by_id(session, user_id)


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
