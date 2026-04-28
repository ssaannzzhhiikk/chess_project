from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import User
from ...persistence_schemas import UserCreate, UserRead
from .exceptions import DuplicateEmailError
from .security import hash_password


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    normalized_email = normalize_email(email)
    return await session.scalar(select(User).where(func.lower(User.email) == normalized_email))


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def create_user(session: AsyncSession, payload: UserCreate) -> UserRead:
    normalized_email = normalize_email(payload.email)
    existing_user = await get_user_by_email(session, normalized_email)
    if existing_user is not None:
        raise DuplicateEmailError(f"User with email '{payload.email}' already exists.")

    user = User(
        email=normalized_email,
        hashed_password=hash_password(payload.password),
    )
    session.add(user)
    await session.flush()
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)
