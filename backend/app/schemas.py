from typing import Literal
from uuid import UUID

from pydantic import BaseModel


InsightSeverity = Literal["best", "inaccuracy", "mistake", "blunder"]
RoomStatus = Literal["waiting", "active", "finished"]
PlayerColor = Literal["white", "black"]
GameOutcome = Literal["white", "black", "draw"]


class CoachExplanationRequest(BaseModel):
    san: str
    severity: InsightSeverity
    best_move: str
    evaluation: int
    delta: int
    position_context: str


class CoachExplanationResponse(BaseModel):
    explanation: str


class RoomMove(BaseModel):
    source: str
    target: str
    promotion: str = "q"


class RoomMoveSummary(BaseModel):
    source: str
    target: str
    san: str
    player_id: UUID
    player_color: PlayerColor


class RoomResignation(BaseModel):
    type: Literal["resign"]


class RoomStatePayload(BaseModel):
    room_id: str
    white_player_id: UUID | None
    black_player_id: UUID | None
    current_fen: str
    moves: list[str]
    status: RoomStatus
    disconnected_players: list[UUID]
    assigned_color: PlayerColor | None = None
    last_move: RoomMoveSummary | None = None
    result: GameOutcome | None = None
    pgn: str = ""
    persisted_game_id: UUID | None = None
    termination: str | None = None


class RoomStateEvent(BaseModel):
    type: Literal["room_state"] = "room_state"
    room: RoomStatePayload


class RoomErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str
