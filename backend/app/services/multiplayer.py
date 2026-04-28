from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

import chess
import chess.pgn
from fastapi import HTTPException, WebSocket, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import User
from ..persistence_schemas import MultiplayerGameCreate, MultiplayerRoomRead
from ..schemas import (
    RoomErrorEvent,
    RoomMove,
    RoomMoveSummary,
    RoomStateEvent,
    RoomStatePayload,
)
from .persistence import create_multiplayer_game as create_multiplayer_game_service


class MultiplayerSocketError(Exception):
    def __init__(self, code: int, reason: str) -> None:
        super().__init__(reason)
        self.code = code
        self.reason = reason


class MultiplayerActionError(Exception):
    pass


@dataclass
class MultiplayerRoom:
    room_id: str
    white_player_id: UUID
    black_player_id: UUID | None = None
    current_fen: str = ""
    moves: list[str] = field(default_factory=list)
    status: str = "waiting"
    disconnected_players: set[UUID] = field(default_factory=set)
    board: chess.Board = field(default_factory=chess.Board)
    connections: dict[UUID, set[WebSocket]] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last_move: RoomMoveSummary | None = None
    result: str | None = None
    termination: str | None = None
    persisted_game_id: UUID | None = None

    def __post_init__(self) -> None:
        self.current_fen = self.board.fen()


class MultiplayerRoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, MultiplayerRoom] = {}
        self._lock = asyncio.Lock()

    async def reset(self) -> None:
        async with self._lock:
            self._rooms = {}

    async def create_room(self, user_id: UUID) -> MultiplayerRoom:
        async with self._lock:
            room_id = self._generate_room_id()
            room = MultiplayerRoom(room_id=room_id, white_player_id=user_id)
            self._rooms[room_id] = room
            return room

    async def join_room(self, room_id: str, user_id: UUID) -> MultiplayerRoom:
        room = await self.get_room(room_id)

        async with room.lock:
            if room.white_player_id == user_id or room.black_player_id == user_id:
                return room

            if room.black_player_id is None:
                room.black_player_id = user_id
                if room.status != "finished":
                    room.status = "active"
                return room

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room is full")

    async def get_room(self, room_id: str) -> MultiplayerRoom:
        async with self._lock:
            room = self._rooms.get(room_id)

        if room is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        return room

    async def get_room_read(self, room_id: str, user_id: UUID) -> MultiplayerRoomRead:
        room = await self.get_room(room_id)
        async with room.lock:
            return self._build_room_read(room, user_id)

    async def connect(self, room_id: str, user_id: UUID, websocket: WebSocket) -> None:
        room = await self.get_room(room_id)

        async with room.lock:
            if self._player_color(room, user_id) is None:
                raise MultiplayerSocketError(status.WS_1008_POLICY_VIOLATION, "Only room participants can connect")

            await websocket.accept()
            room.connections.setdefault(user_id, set()).add(websocket)
            room.disconnected_players.discard(user_id)
            event = self._build_room_state_event(room, user_id)

        await websocket.send_json(event.model_dump(mode="json"))

    async def disconnect(self, room_id: str, user_id: UUID, websocket: WebSocket) -> None:
        try:
            room = await self.get_room(room_id)
        except HTTPException:
            return

        async with room.lock:
            connections = room.connections.get(user_id)
            if connections is None:
                return

            connections.discard(websocket)
            if connections:
                return

            room.connections.pop(user_id, None)
            if room.white_player_id == user_id or room.black_player_id == user_id:
                room.disconnected_players.add(user_id)

    async def broadcast_room_state(self, room: MultiplayerRoom) -> None:
        async with room.lock:
            events = self._build_room_events(room)
        await self._send_events(events)

    async def process_move(self, session: AsyncSession, room_id: str, user_id: UUID, payload: RoomMove) -> None:
        room = await self.get_room(room_id)

        async with room.lock:
            color = self._player_color(room, user_id)
            if color is None:
                raise MultiplayerActionError("You are not a player in this room.")
            if room.status != "active":
                raise MultiplayerActionError("Room is not active.")
            if room.result is not None:
                raise MultiplayerActionError("Game already finished.")
            if room.board.turn != self._color_to_turn(color):
                raise MultiplayerActionError("It is not your turn.")

            move = self._validate_move(room.board, payload)
            san = room.board.san(move)
            room.board.push(move)
            room.moves.append(san)
            room.current_fen = room.board.fen()
            room.last_move = RoomMoveSummary(
                source=payload.source,
                target=payload.target,
                san=san,
                player_id=user_id,
                player_color=color,
            )

            if room.board.is_game_over(claim_draw=True):
                await self._finish_room_locked(session, room)

            events = self._build_room_events(room)

        await self._send_events(events)

    async def process_resignation(self, session: AsyncSession, room_id: str, user_id: UUID) -> None:
        room = await self.get_room(room_id)

        async with room.lock:
            color = self._player_color(room, user_id)
            if color is None:
                raise MultiplayerActionError("You are not a player in this room.")
            if room.status != "active":
                raise MultiplayerActionError("Room is not active.")
            if room.result is not None:
                raise MultiplayerActionError("Game already finished.")

            winner = "black" if color == "white" else "white"
            await self._finish_room_locked(session, room, result=winner, termination="resignation")
            events = self._build_room_events(room)

        await self._send_events(events)

    async def send_error(self, websocket: WebSocket, message: str) -> None:
        await websocket.send_json(RoomErrorEvent(message=message).model_dump())

    async def resolve_user(self, session: AsyncSession, token: str | None) -> User | None:
        if not token:
            return None

        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            subject = payload.get("sub")
            if subject is None:
                return None
            user_id = UUID(subject)
        except (JWTError, ValueError):
            return None

        return await session.get(User, user_id)

    def _build_room_read(self, room: MultiplayerRoom, user_id: UUID) -> MultiplayerRoomRead:
        return MultiplayerRoomRead(
            room_id=room.room_id,
            white_player_id=room.white_player_id,
            black_player_id=room.black_player_id,
            current_fen=room.current_fen,
            moves=list(room.moves),
            status=room.status,
            disconnected_players=sorted(room.disconnected_players, key=str),
            assigned_color=self._player_color(room, user_id),
            result=room.result,
            pgn=self._build_pgn(room),
            persisted_game_id=room.persisted_game_id,
            termination=room.termination,
        )

    def _build_room_state_event(self, room: MultiplayerRoom, user_id: UUID) -> RoomStateEvent:
        return RoomStateEvent(
            room=RoomStatePayload(
                room_id=room.room_id,
                white_player_id=room.white_player_id,
                black_player_id=room.black_player_id,
                current_fen=room.current_fen,
                moves=list(room.moves),
                status=room.status,
                disconnected_players=sorted(room.disconnected_players, key=str),
                assigned_color=self._player_color(room, user_id),
                last_move=room.last_move,
                result=room.result,
                pgn=self._build_pgn(room),
                persisted_game_id=room.persisted_game_id,
                termination=room.termination,
            )
        )

    def _build_room_events(self, room: MultiplayerRoom) -> list[tuple[WebSocket, dict[str, Any]]]:
        events: list[tuple[WebSocket, dict[str, Any]]] = []
        for user_id, sockets in room.connections.items():
            payload = self._build_room_state_event(room, user_id).model_dump(mode="json")
            for websocket in sockets:
                events.append((websocket, payload))
        return events

    async def _send_events(self, events: list[tuple[WebSocket, dict[str, Any]]]) -> None:
        for websocket, payload in events:
            await websocket.send_json(payload)

    async def _finish_room_locked(
        self,
        session: AsyncSession,
        room: MultiplayerRoom,
        *,
        result: str | None = None,
        termination: str | None = None,
    ) -> None:
        if room.status == "finished":
            return

        resolved_result = result
        resolved_termination = termination
        if resolved_result is None:
            outcome = room.board.outcome(claim_draw=True)
            if outcome is None:
                return
            resolved_result = "draw" if outcome.winner is None else ("white" if outcome.winner else "black")
            resolved_termination = outcome.termination.name.lower()

        room.status = "finished"
        room.result = resolved_result
        room.termination = resolved_termination
        room.current_fen = room.board.fen()

        if room.white_player_id is None or room.black_player_id is None or room.persisted_game_id is not None:
            return

        pgn = self._build_pgn(room)
        saved_game = await create_multiplayer_game_service(
            session,
            MultiplayerGameCreate(
                white_user_id=room.white_player_id,
                black_user_id=room.black_player_id,
                winner_user_id=self._winner_user_id(room, resolved_result),
                result=resolved_result,
                pgn=pgn,
                moves=list(room.moves),
            ),
        )
        room.persisted_game_id = saved_game.id

    def _build_pgn(self, room: MultiplayerRoom) -> str:
        game = chess.pgn.Game.from_board(room.board)
        game.headers["Event"] = "Endgame Multiplayer"
        game.headers["Site"] = room.room_id
        game.headers["White"] = str(room.white_player_id)
        game.headers["Black"] = str(room.black_player_id) if room.black_player_id else "Pending"
        if room.result is not None:
            game.headers["Result"] = self._result_to_pgn(room.result)
        return str(game.accept(chess.pgn.StringExporter(headers=True, variations=False, comments=False))).strip()

    def _color_to_turn(self, color: str) -> bool:
        return chess.WHITE if color == "white" else chess.BLACK

    def _player_color(self, room: MultiplayerRoom, user_id: UUID) -> str | None:
        if room.white_player_id == user_id:
            return "white"
        if room.black_player_id == user_id:
            return "black"
        return None

    def _validate_move(self, board: chess.Board, payload: RoomMove) -> chess.Move:
        basic_uci = f"{payload.source}{payload.target}"

        try:
            candidate = chess.Move.from_uci(basic_uci)
        except ValueError as exc:
            raise MultiplayerActionError("Invalid move payload.") from exc

        if candidate in board.legal_moves:
            return candidate

        promotion = (payload.promotion or "q").lower()
        if promotion not in {"q", "r", "b", "n"}:
            raise MultiplayerActionError("Invalid promotion piece.")

        try:
            promoted = chess.Move.from_uci(f"{basic_uci}{promotion}")
        except ValueError as exc:
            raise MultiplayerActionError("Invalid move payload.") from exc

        if promoted not in board.legal_moves:
            raise MultiplayerActionError("Illegal move.")
        return promoted

    def _winner_user_id(self, room: MultiplayerRoom, result: str) -> UUID | None:
        if result == "white":
            return room.white_player_id
        if result == "black":
            return room.black_player_id
        return None

    def _result_to_pgn(self, result: str) -> str:
        if result == "white":
            return "1-0"
        if result == "black":
            return "0-1"
        return "1/2-1/2"

    def _generate_room_id(self) -> str:
        while True:
            room_id = uuid4().hex[:8]
            if room_id not in self._rooms:
                return room_id


room_manager = MultiplayerRoomManager()
