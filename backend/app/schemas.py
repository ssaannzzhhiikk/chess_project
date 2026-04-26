from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


GameMode = Literal["local", "ai", "online"]
GameResult = Literal["white", "black", "draw"]
InsightSeverity = Literal["best", "inaccuracy", "mistake", "blunder"]


class Achievement(BaseModel):
    id: str
    name: str
    description: str


class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    username: str
    city: str
    rating: int = 1200
    xp: int = 0
    level: int = 1
    is_pro: bool = False
    wins: int = 0
    losses: int = 0
    draws: int = 0
    achievements: list[str] = []


class GameRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    mode: GameMode
    result: GameResult
    pgn: str
    moves: list[str]
    opening: str | None = None
    city: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CoachInsight(BaseModel):
    ply: int
    san: str
    severity: InsightSeverity
    best_move: str
    evaluation: int
    delta: int
    explanation: str | None = None


class LoginRequest(BaseModel):
    username: str
    city: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    profile: UserProfile


class CreateGameRequest(BaseModel):
    user_id: str
    mode: GameMode
    room_id: str | None = None


class FinishGameRequest(BaseModel):
    result: GameResult
    pgn: str
    moves: list[str]
    opening: str | None = None
    insights: list[CoachInsight] = []


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
    san: str
    fen: str
    pgn: str


class LeaderboardEntry(BaseModel):
    username: str
    city: str
    rating: int
    xp: int
    wins: int
    losses: int
    level: int

