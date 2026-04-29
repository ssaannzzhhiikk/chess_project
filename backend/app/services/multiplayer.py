from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

import chess
import chess.pgn
from fastapi import HTTPException, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from ..persistence_schemas import MultiplayerGameCreate, MultiplayerRoomRead
from ..schemas import (
    RoomErrorEvent,
    RoomMove,
    RoomMoveSummary,
    RoomStateEvent,
    RoomStatePayload,
)
from .multiplayer_state_store import (
    MultiplayerRoomState,
    MultiplayerRoomStateStore,
    build_multiplayer_room_state_store,
)
from .persistence import create_multiplayer_game as create_multiplayer_game_service
from .persistence.auth import resolve_user_from_access_token


class MultiplayerSocketError(Exception):
    def __init__(self, ws_code: int, error_code: str, message: str) -> None:
        super().__init__(message)
        self.ws_code = ws_code
        self.error_code = error_code
        self.message = message


class MultiplayerActionError(Exception):
    def __init__(self, error_code: str, message: str) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message


@dataclass
class RoomRuntime:
    connections: dict[UUID, set[WebSocket]] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class MultiplayerRoomManager:
    def __init__(self, state_store: MultiplayerRoomStateStore | None = None) -> None:
        self._state_store = state_store or build_multiplayer_room_state_store()
        self._runtime: dict[str, RoomRuntime] = {}
        self._runtime_lock = asyncio.Lock()

    async def reset(self, *, clear_persistent: bool = True) -> None:
        async with self._runtime_lock:
            self._runtime = {}
        await self._state_store.reset(clear_persistent=clear_persistent)

    async def create_room(self, user_id: UUID) -> MultiplayerRoomState:
        while True:
            room = MultiplayerRoomState(room_id=self._generate_room_id(), white_player_id=user_id)
            if await self._state_store.create_room(room):
                await self._ensure_runtime(room.room_id)
                return room

    async def join_room(self, room_id: str, user_id: UUID) -> MultiplayerRoomState:
        runtime = await self._ensure_runtime(room_id)
        async with runtime.lock:
            room = await self._require_room(room_id)

            if room.white_player_id == user_id or room.black_player_id == user_id:
                return room

            if room.black_player_id is None:
                room.black_player_id = user_id
                if room.status != "finished":
                    room.status = "active"
                await self._state_store.save_room(room)
                return room

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room is full")

    async def get_room(self, room_id: str) -> MultiplayerRoomState:
        return await self._require_room(room_id)

    async def get_room_read(self, room_id: str, user_id: UUID) -> MultiplayerRoomRead:
        room = await self._require_room(room_id)
        return self._build_room_read(room, user_id)

    async def connect(self, room_id: str, user_id: UUID, websocket: WebSocket) -> None:
        runtime = await self._ensure_runtime(room_id)
        async with runtime.lock:
            room = await self._state_store.get_room(room_id)
            if room is None:
                raise MultiplayerSocketError(
                    status.WS_1008_POLICY_VIOLATION,
                    "room_not_found",
                    "Room not found.",
                )

            color = self._player_color(room, user_id)
            if color is None:
                error_code = "room_full" if room.black_player_id is not None else "player_not_in_room"
                message = "Room is full." if error_code == "room_full" else "You are not a player in this room."
                raise MultiplayerSocketError(status.WS_1008_POLICY_VIOLATION, error_code, message)

            runtime.connections.setdefault(user_id, set()).add(websocket)
            room.disconnected_players.discard(user_id)
            await self._state_store.save_room(room)
            event = self._build_room_state_event(room, user_id)

        await websocket.send_json(event.model_dump(mode="json"))

    async def disconnect(self, room_id: str, user_id: UUID, websocket: WebSocket) -> None:
        runtime = await self._ensure_runtime(room_id)
        async with runtime.lock:
            connections = runtime.connections.get(user_id)
            if connections is None:
                return

            connections.discard(websocket)
            if connections:
                return

            runtime.connections.pop(user_id, None)
            room = await self._state_store.get_room(room_id)
            if room is None:
                return

            if room.white_player_id == user_id or room.black_player_id == user_id:
                room.disconnected_players.add(user_id)
                await self._state_store.save_room(room)

    async def broadcast_room_state(self, room: MultiplayerRoomState) -> None:
        runtime = await self._ensure_runtime(room.room_id)
        async with runtime.lock:
            latest_room = await self._require_room(room.room_id)
            events = self._build_room_events(latest_room, runtime)
        await self._send_events(events)

    async def process_move(self, session: AsyncSession, room_id: str, user_id: UUID, payload: RoomMove) -> None:
        runtime = await self._ensure_runtime(room_id)
        async with runtime.lock:
            room = await self._state_store.get_room(room_id)
            if room is None:
                raise MultiplayerActionError("room_not_found", "Room not found.")

            color = self._player_color(room, user_id)
            if color is None:
                raise MultiplayerActionError("player_not_in_room", "You are not a player in this room.")
            if room.result is not None or room.status == "finished":
                raise MultiplayerActionError("game_already_finished", "Game already finished.")
            if room.status != "active":
                raise MultiplayerActionError("room_not_active", "Room is not active.")

            board = room.board()
            if board.turn != self._color_to_turn(color):
                raise MultiplayerActionError("wrong_turn", "It is not your turn.")

            move = self._validate_move(board, payload)
            san = board.san(move)
            board.push(move)

            room.moves.append(san)
            room.current_fen = board.fen()
            room.last_move = RoomMoveSummary(
                source=payload.source,
                target=payload.target,
                san=san,
                player_id=user_id,
                player_color=color,
            )

            if board.is_game_over(claim_draw=True):
                await self._finish_room_locked(session, room, board=board)

            await self._state_store.save_room(room)
            events = self._build_room_events(room, runtime)

        await self._send_events(events)

    async def process_resignation(self, session: AsyncSession, room_id: str, user_id: UUID) -> None:
        runtime = await self._ensure_runtime(room_id)
        async with runtime.lock:
            room = await self._state_store.get_room(room_id)
            if room is None:
                raise MultiplayerActionError("room_not_found", "Room not found.")

            color = self._player_color(room, user_id)
            if color is None:
                raise MultiplayerActionError("player_not_in_room", "You are not a player in this room.")
            if room.result is not None or room.status == "finished":
                raise MultiplayerActionError("game_already_finished", "Game already finished.")
            if room.status != "active":
                raise MultiplayerActionError("room_not_active", "Room is not active.")

            winner = "black" if color == "white" else "white"
            await self._finish_room_locked(session, room, result=winner, termination="resignation")
            await self._state_store.save_room(room)
            events = self._build_room_events(room, runtime)

        await self._send_events(events)

    async def send_error(self, websocket: WebSocket, error_code: str, message: str) -> None:
        await websocket.send_json(
            RoomErrorEvent(
                code=error_code,
                message=message,
            ).model_dump()
        )

    async def send_socket_error_and_close(
        self,
        websocket: WebSocket,
        *,
        error_code: str,
        message: str,
        ws_code: int = status.WS_1008_POLICY_VIOLATION,
    ) -> None:
        await websocket.accept()
        await self.send_error(websocket, error_code, message)
        await websocket.close(code=ws_code, reason=message)

    async def resolve_user(self, session: AsyncSession, token: str | None) -> User | None:
        return await resolve_user_from_access_token(session, token)

    def _build_room_read(self, room: MultiplayerRoomState, user_id: UUID) -> MultiplayerRoomRead:
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

    def _build_room_state_event(self, room: MultiplayerRoomState, user_id: UUID) -> RoomStateEvent:
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

    def _build_room_events(
        self,
        room: MultiplayerRoomState,
        runtime: RoomRuntime,
    ) -> list[tuple[WebSocket, dict[str, Any]]]:
        events: list[tuple[WebSocket, dict[str, Any]]] = []
        for user_id, sockets in runtime.connections.items():
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
        room: MultiplayerRoomState,
        *,
        board: chess.Board | None = None,
        result: str | None = None,
        termination: str | None = None,
    ) -> None:
        if room.status == "finished":
            return

        active_board = board or room.board()

        resolved_result = result
        resolved_termination = termination
        if resolved_result is None:
            outcome = active_board.outcome(claim_draw=True)
            if outcome is None:
                return
            resolved_result = "draw" if outcome.winner is None else ("white" if outcome.winner else "black")
            resolved_termination = outcome.termination.name.lower()

        room.status = "finished"
        room.result = resolved_result
        room.termination = resolved_termination
        room.current_fen = active_board.fen()

        if room.white_player_id is None or room.black_player_id is None or room.persisted_game_id is not None:
            return

        saved_game = await create_multiplayer_game_service(
            session,
            MultiplayerGameCreate(
                white_user_id=room.white_player_id,
                black_user_id=room.black_player_id,
                winner_user_id=self._winner_user_id(room, resolved_result),
                result=resolved_result,
                pgn=self._build_pgn(room),
                moves=list(room.moves),
            ),
        )
        room.persisted_game_id = saved_game.id

    def _build_pgn(self, room: MultiplayerRoomState) -> str:
        game = chess.pgn.Game.from_board(room.board())
        game.headers["Event"] = "Endgame Multiplayer"
        game.headers["Site"] = room.room_id
        game.headers["White"] = str(room.white_player_id)
        game.headers["Black"] = str(room.black_player_id) if room.black_player_id else "Pending"
        if room.result is not None:
            game.headers["Result"] = self._result_to_pgn(room.result)
        return str(game.accept(chess.pgn.StringExporter(headers=True, variations=False, comments=False))).strip()

    async def _require_room(self, room_id: str) -> MultiplayerRoomState:
        room = await self._state_store.get_room(room_id)
        if room is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        return room

    async def _ensure_runtime(self, room_id: str) -> RoomRuntime:
        async with self._runtime_lock:
            runtime = self._runtime.get(room_id)
            if runtime is None:
                runtime = RoomRuntime()
                self._runtime[room_id] = runtime
            return runtime

    def _color_to_turn(self, color: str) -> bool:
        return chess.WHITE if color == "white" else chess.BLACK

    def _player_color(self, room: MultiplayerRoomState, user_id: UUID) -> str | None:
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
            raise MultiplayerActionError("invalid_move_payload", "Invalid move payload.") from exc

        if candidate in board.legal_moves:
            return candidate

        promotion = (payload.promotion or "q").lower()
        if promotion not in {"q", "r", "b", "n"}:
            raise MultiplayerActionError("invalid_move_payload", "Invalid promotion piece.")

        try:
            promoted = chess.Move.from_uci(f"{basic_uci}{promotion}")
        except ValueError as exc:
            raise MultiplayerActionError("invalid_move_payload", "Invalid move payload.") from exc

        if promoted not in board.legal_moves:
            raise MultiplayerActionError("illegal_move", "Illegal move.")
        return promoted

    def _winner_user_id(self, room: MultiplayerRoomState, result: str) -> UUID | None:
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
        return uuid4().hex[:8]


room_manager = MultiplayerRoomManager()
