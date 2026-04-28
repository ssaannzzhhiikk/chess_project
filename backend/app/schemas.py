from typing import Literal

from pydantic import BaseModel


InsightSeverity = Literal["best", "inaccuracy", "mistake", "blunder"]


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
