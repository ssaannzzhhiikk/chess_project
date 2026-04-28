from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import chess

from ..config import settings
from ..schemas import RoomMoveSummary

try:
    from redis.asyncio import Redis
except ImportError:  # pragma: no cover - optional dependency at import time
    Redis = None  # type: ignore[assignment]


REDIS_ROOM_KEY_PREFIX = "endgame:multiplayer:room:"


@dataclass
class MultiplayerRoomState:
    room_id: str
    white_player_id: UUID
    black_player_id: UUID | None = None
    current_fen: str = field(default_factory=lambda: chess.STARTING_FEN)
    moves: list[str] = field(default_factory=list)
    status: str = "waiting"
    disconnected_players: set[UUID] = field(default_factory=set)
    last_move: RoomMoveSummary | None = None
    result: str | None = None
    termination: str | None = None
    persisted_game_id: UUID | None = None

    def to_redis_payload(self) -> dict[str, Any]:
        return {
            "room_id": self.room_id,
            "white_player_id": str(self.white_player_id),
            "black_player_id": str(self.black_player_id) if self.black_player_id is not None else None,
            "current_fen": self.current_fen,
            "moves": list(self.moves),
            "status": self.status,
            "disconnected_players": [str(player_id) for player_id in sorted(self.disconnected_players, key=str)],
            "last_move": self.last_move.model_dump(mode="json") if self.last_move is not None else None,
            "result": self.result,
            "termination": self.termination,
            "persisted_game_id": str(self.persisted_game_id) if self.persisted_game_id is not None else None,
        }

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "MultiplayerRoomState":
        last_move_payload = payload.get("last_move")
        return cls(
            room_id=payload["room_id"],
            white_player_id=UUID(payload["white_player_id"]),
            black_player_id=UUID(payload["black_player_id"]) if payload.get("black_player_id") else None,
            current_fen=payload.get("current_fen") or chess.STARTING_FEN,
            moves=[str(move) for move in payload.get("moves", [])],
            status=payload.get("status", "waiting"),
            disconnected_players={
                UUID(player_id) for player_id in payload.get("disconnected_players", [])
            },
            last_move=RoomMoveSummary.model_validate(last_move_payload) if last_move_payload else None,
            result=payload.get("result"),
            termination=payload.get("termination"),
            persisted_game_id=UUID(payload["persisted_game_id"]) if payload.get("persisted_game_id") else None,
        )

    def board(self) -> chess.Board:
        return chess.Board(self.current_fen)


class MultiplayerRoomStateStore:
    async def create_room(self, room: MultiplayerRoomState) -> bool:
        raise NotImplementedError

    async def get_room(self, room_id: str) -> MultiplayerRoomState | None:
        raise NotImplementedError

    async def save_room(self, room: MultiplayerRoomState) -> None:
        raise NotImplementedError

    async def reset(self, *, clear_persistent: bool) -> None:
        raise NotImplementedError


class InMemoryRoomStateStore(MultiplayerRoomStateStore):
    def __init__(self) -> None:
        self._rooms: dict[str, MultiplayerRoomState] = {}

    async def create_room(self, room: MultiplayerRoomState) -> bool:
        if room.room_id in self._rooms:
            return False
        self._rooms[room.room_id] = MultiplayerRoomState.from_payload(room.to_redis_payload())
        return True

    async def get_room(self, room_id: str) -> MultiplayerRoomState | None:
        room = self._rooms.get(room_id)
        if room is None:
            return None
        return MultiplayerRoomState.from_payload(room.to_redis_payload())

    async def save_room(self, room: MultiplayerRoomState) -> None:
        self._rooms[room.room_id] = MultiplayerRoomState.from_payload(room.to_redis_payload())

    async def reset(self, *, clear_persistent: bool) -> None:
        if clear_persistent:
            self._rooms = {}


class RedisRoomStateStore(MultiplayerRoomStateStore):
    def __init__(self, redis_url: str) -> None:
        if Redis is None:
            raise RuntimeError("redis package is required when REDIS_URL is configured.")
        self._client = Redis.from_url(redis_url, decode_responses=True)

    def _key(self, room_id: str) -> str:
        return f"{REDIS_ROOM_KEY_PREFIX}{room_id}"

    async def create_room(self, room: MultiplayerRoomState) -> bool:
        return bool(
            await self._client.set(
                self._key(room.room_id),
                json.dumps(room.to_redis_payload()),
                nx=True,
            )
        )

    async def get_room(self, room_id: str) -> MultiplayerRoomState | None:
        payload = await self._client.get(self._key(room_id))
        if payload is None:
            return None
        return MultiplayerRoomState.from_payload(json.loads(payload))

    async def save_room(self, room: MultiplayerRoomState) -> None:
        await self._client.set(self._key(room.room_id), json.dumps(room.to_redis_payload()))

    async def reset(self, *, clear_persistent: bool) -> None:
        if not clear_persistent:
            return

        keys = [key async for key in self._client.scan_iter(f"{REDIS_ROOM_KEY_PREFIX}*")]
        if keys:
            await self._client.delete(*keys)


def build_multiplayer_room_state_store() -> MultiplayerRoomStateStore:
    if settings.redis_url:
        return RedisRoomStateStore(settings.redis_url)
    return InMemoryRoomStateStore()
