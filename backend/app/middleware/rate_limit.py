from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import Request, status
from starlette.responses import JSONResponse, Response


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    limit: int
    window_seconds: int
    message: str


JOIN_ROOM_PATTERN = re.compile(r"^/api/multiplayer/rooms/[^/]+/join$")
RATE_LIMIT_RULES: dict[tuple[str, str], RateLimitRule] = {
    ("POST", "/api/auth/login"): RateLimitRule(
        name="auth_login",
        limit=5,
        window_seconds=60,
        message="Too many login attempts. Please try again in a minute.",
    ),
    ("POST", "/api/auth/register"): RateLimitRule(
        name="auth_register",
        limit=5,
        window_seconds=60,
        message="Too many registration attempts. Please try again in a minute.",
    ),
    ("POST", "/api/analyze-game"): RateLimitRule(
        name="analyze_game",
        limit=15,
        window_seconds=60,
        message="Too many analysis requests. Please retry shortly.",
    ),
    ("POST", "/api/coach/explain"): RateLimitRule(
        name="coach_explain",
        limit=20,
        window_seconds=60,
        message="Too many coach explanation requests. Please retry shortly.",
    ),
    ("POST", "/api/multiplayer/rooms"): RateLimitRule(
        name="multiplayer_room_create",
        limit=15,
        window_seconds=60,
        message="Too many room creation requests. Please retry shortly.",
    ),
}
JOIN_ROOM_RULE = RateLimitRule(
    name="multiplayer_room_join",
    limit=20,
    window_seconds=60,
    message="Too many room join requests. Please retry shortly.",
)


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def reset(self) -> None:
        self._buckets = defaultdict(deque)

    def allow(self, key: str, *, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        bucket = self._buckets[key]

        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            return False

        bucket.append(now)
        return True


in_memory_rate_limiter = InMemoryRateLimiter()


def resolve_rate_limit_rule(method: str, path: str) -> RateLimitRule | None:
    direct_match = RATE_LIMIT_RULES.get((method.upper(), path))
    if direct_match is not None:
        return direct_match

    if method.upper() == "POST" and JOIN_ROOM_PATTERN.fullmatch(path) is not None:
        return JOIN_ROOM_RULE

    return None


def build_rate_limit_key(request: Request, rule: RateLimitRule) -> str:
    client_host = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    identity = forwarded_for.split(",")[0].strip() if forwarded_for else client_host
    return f"{rule.name}:{identity}"


async def enforce_rate_limits(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    rule = resolve_rate_limit_rule(request.method, request.url.path)
    if rule is None:
        return await call_next(request)

    key = build_rate_limit_key(request, rule)
    if not in_memory_rate_limiter.allow(key, limit=rule.limit, window_seconds=rule.window_seconds):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": rule.message},
        )

    return await call_next(request)
