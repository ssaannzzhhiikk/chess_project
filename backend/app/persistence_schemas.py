from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


GameMode = Literal["ai", "multiplayer"]
GameResult = Literal["win", "loss", "draw"]
LeaderboardSort = Literal["xp", "wins"]
JSONList = list[str | dict[str, Any]]


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


class CoachInsightCreate(BaseModel):
    game_id: UUID
    summary: str = Field(min_length=1)
    mistakes_count: int = Field(default=0, ge=0)
    blunders_count: int = Field(default=0, ge=0)
    best_moves: JSONList = Field(default_factory=list)


class CoachInsightRead(PersistenceSchema):
    id: UUID
    game_id: UUID
    summary: str
    mistakes_count: int
    blunders_count: int
    best_moves: JSONList


class AchievementRead(PersistenceSchema):
    id: UUID
    user_id: UUID
    type: str
    created_at: datetime
