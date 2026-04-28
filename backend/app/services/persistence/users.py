from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import User
from ...persistence_schemas import UserCreate, UserRead
from .exceptions import DuplicateEmailError
from .security import hash_password


async def create_user(session: AsyncSession, payload: UserCreate) -> UserRead:
    normalized_email = payload.email.strip()
    existing_user_id = await session.scalar(select(User.id).where(User.email == normalized_email))
    if existing_user_id is not None:
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
