from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


GameMode = Literal["ai", "multiplayer"]
GameResult = Literal["win", "loss", "draw"]
LeaderboardSort = Literal["xp", "wins"]
JSONList = list[str | dict[str, Any]]
RoomStatus = Literal["waiting", "active", "finished"]
PlayerColor = Literal["white", "black"]
GameOutcome = Literal["white", "black", "draw"]
MoveReviewSeverity = Literal["best", "inaccuracy", "mistake", "blunder"]


class PersistenceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1)


class UserRead(PersistenceSchema):
    id: UUID
    email: str
    is_pro: bool
    xp: int
    wins: int
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class GameCreate(BaseModel):
    user_id: UUID
    pgn: str = ""
    moves: JSONList = Field(default_factory=list)
    result: GameResult
    mode: GameMode


class GameCreateRequest(BaseModel):
    pgn: str = ""
    moves: JSONList = Field(default_factory=list)
    result: GameResult
    mode: GameMode


class GameRead(PersistenceSchema):
    id: UUID
    user_id: UUID
    pgn: str
    moves: JSONList
    result: GameResult
    mode: GameMode
    created_at: datetime


class LeaderboardEntryRead(BaseModel):
    username: str
    city: str
    rating: int
    xp: int
    wins: int
    losses: int
    level: int


class ProfileUserRead(BaseModel):
    id: UUID
    email: str
    username: str
    is_pro: bool
    xp: int
    wins: int
    level: int
    rating: int
    created_at: datetime


class ProfileStatsRead(BaseModel):
    total_games: int
    wins: int
    losses: int
    draws: int
    xp: int
    level: int
    rating: int


class ProfileRead(BaseModel):
    user: ProfileUserRead
    stats: ProfileStatsRead
    recent_games: list[GameRead]


class MoveReview(BaseModel):
    ply: int = Field(ge=1)
    san: str = Field(min_length=1)
    best_move: str = Field(min_length=1)
    severity: MoveReviewSeverity
    evaluation: int
    delta: int = Field(ge=0)
    summary: str = Field(min_length=1)


class CoachInsightCreate(BaseModel):
    game_id: UUID
    summary: str = Field(min_length=1)
    mistakes_count: int = Field(default=0, ge=0)
    blunders_count: int = Field(default=0, ge=0)
    best_moves: JSONList = Field(default_factory=list)
    move_reviews: list[MoveReview] = Field(default_factory=list)


class CoachInsightRead(PersistenceSchema):
    id: UUID
    game_id: UUID
    summary: str
    mistakes_count: int
    blunders_count: int
    best_moves: JSONList
    move_reviews: list[MoveReview] = Field(default_factory=list)


class AnalyzeGameRequest(BaseModel):
    game_id: UUID | None = None
    pgn: str | None = None

    @model_validator(mode="after")
    def validate_input(self) -> "AnalyzeGameRequest":
        if self.game_id is None and not (self.pgn and self.pgn.strip()):
            raise ValueError("Either game_id or pgn must be provided.")
        return self


class AnalyzeGameResponse(BaseModel):
    summary: str
    mistakes_count: int = Field(default=0, ge=0)
    blunders_count: int = Field(default=0, ge=0)
    best_moves: list[str] = Field(default_factory=list)
    move_reviews: list[MoveReview] = Field(default_factory=list)


class UpgradeResponse(BaseModel):
    message: str
    user: UserRead


class MultiplayerRoomRead(BaseModel):
    room_id: str
    white_player_id: UUID | None
    black_player_id: UUID | None
    current_fen: str
    moves: list[str] = Field(default_factory=list)
    status: RoomStatus
    disconnected_players: list[UUID] = Field(default_factory=list)
    assigned_color: PlayerColor | None = None
    result: GameOutcome | None = None
    pgn: str = ""
    persisted_game_id: UUID | None = None
    termination: str | None = None


class MultiplayerGameCreate(BaseModel):
    white_user_id: UUID
    black_user_id: UUID
    winner_user_id: UUID | None = None
    result: GameOutcome
    pgn: str = ""
    moves: list[str] = Field(default_factory=list)


class MultiplayerGameRead(PersistenceSchema):
    id: UUID
    white_user_id: UUID
    black_user_id: UUID
    winner_user_id: UUID | None
    result: GameOutcome
    pgn: str
    moves: list[str]
    created_at: datetime


class AchievementRead(PersistenceSchema):
    id: UUID
    user_id: UUID
    type: str
    created_at: datetime
