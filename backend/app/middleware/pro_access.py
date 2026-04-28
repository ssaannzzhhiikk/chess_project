from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from fastapi import Request, status
from jose import JWTError, jwt
from starlette.responses import JSONResponse, Response

from ..config import settings
from ..db import AsyncSessionLocal
from ..models import User


PROTECTED_ROUTES = {
    ("POST", "/api/analyze-game"),
    ("POST", "/api/coach/explain"),
}
ANALYSIS_ROUTE_PATTERN = re.compile(r"^/api/games/[^/]+/analysis$")


def route_requires_pro(method: str, path: str) -> bool:
    return (method.upper(), path) in PROTECTED_ROUTES or (
        method.upper() == "GET" and ANALYSIS_ROUTE_PATTERN.fullmatch(path) is not None
    )


async def resolve_authenticated_user(request: Request) -> User | None:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if subject is None:
            return None
        user_id = UUID(subject)
    except (JWTError, ValueError):
        return None

    async with AsyncSessionLocal() as session:
        return await session.get(User, user_id)


async def enforce_pro_access(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if not route_requires_pro(request.method, request.url.path):
        return await call_next(request)

    user = await resolve_authenticated_user(request)
    if user is None:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Could not validate credentials"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_pro:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Pro subscription required"},
        )

    return await call_next(request)
