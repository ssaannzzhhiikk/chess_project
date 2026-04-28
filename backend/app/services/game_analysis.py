from __future__ import annotations

import re
from collections.abc import Sequence

from ..persistence_schemas import AnalyzeGameResponse


RESULT_MARKERS = {"1-0", "0-1", "1/2-1/2", "*"}
MOVE_NUMBER_PATTERN = re.compile(r"^\d+\.(?:\.\.)?$")
COMMENT_PATTERN = re.compile(r"\{[^}]*\}|\([^)]*\)")
TAG_PATTERN = re.compile(r"\[[^\]]*\]")
GOOD_DEVELOPMENT_MOVES = {"e4", "d4", "c4", "Nf3", "Nc3", "Bc4", "Bb5", "O-O", "O-O-O"}


def parse_pgn_moves(pgn: str) -> list[str]:
    cleaned = TAG_PATTERN.sub(" ", pgn)
    cleaned = COMMENT_PATTERN.sub(" ", cleaned)
    tokens: list[str] = []

    for raw_token in cleaned.replace("\n", " ").split():
        token = raw_token.strip()
        if not token or token in RESULT_MARKERS or MOVE_NUMBER_PATTERN.fullmatch(token):
            continue
        if token.startswith("$"):
            continue
        tokens.append(token)

    return tokens


def sanitize_move(move: str) -> str:
    return move.rstrip("?!+#")


def classify_move(move: str, ply: int, queen_moves_seen: int) -> str | None:
    normalized = sanitize_move(move)

    if "??" in move:
        return "blunder"
    if "?" in move:
        return "mistake"
    if ply <= 16 and normalized.startswith("K") and normalized not in {"O-O", "O-O-O"}:
        return "blunder"
    if ply <= 12 and normalized.startswith("Q") and "+" not in move and "#" not in move:
        return "blunder" if queen_moves_seen > 0 else "mistake"
    if ply <= 12 and normalized[0] in {"a", "h", "f"} and "x" not in normalized:
        return "mistake"
    return None


def suggest_best_moves(moves: Sequence[str]) -> list[str]:
    normalized_moves = [sanitize_move(move) for move in moves]
    suggestions: list[str] = []

    if not any(move in {"e4", "d4", "c4"} for move in normalized_moves[:4]):
        suggestions.extend(["e4", "d4"])
    if not any(move in {"Nf3", "Nc3", "Bc4", "Bb5"} for move in normalized_moves[:8]):
        suggestions.append("Nf3")
    if len(normalized_moves) >= 6 and not any(move in {"O-O", "O-O-O"} for move in normalized_moves[:16]):
        suggestions.append("O-O")

    for move in normalized_moves:
        if move in GOOD_DEVELOPMENT_MOVES and move not in suggestions:
            suggestions.append(move)

    if not suggestions:
        suggestions = ["Nf3", "O-O", "Re1"]

    unique_suggestions: list[str] = []
    for move in suggestions:
        if move not in unique_suggestions:
            unique_suggestions.append(move)
    return unique_suggestions[:3]


def build_analysis_summary(
    move_count: int,
    mistakes_count: int,
    blunders_count: int,
    best_moves: Sequence[str],
) -> str:
    if move_count == 0:
        return "No moves were available for review."
    if blunders_count == 0 and mistakes_count == 0:
        return (
            f"Reviewed {move_count} moves and found no major heuristic issues. "
            f"Keep building with ideas like {', '.join(best_moves)}."
        )
    if blunders_count > 0:
        return (
            f"Reviewed {move_count} moves and found {blunders_count} blunder(s) "
            f"and {mistakes_count} mistake(s). Tighten king safety and development around {', '.join(best_moves)}."
        )
    return (
        f"Reviewed {move_count} moves and found {mistakes_count} mistake(s). "
        f"The position stayed playable, but stronger setups like {', '.join(best_moves)} were available."
    )


def analyze_game_content(pgn: str, moves: Sequence[str] | None = None) -> AnalyzeGameResponse:
    parsed_moves = [move for move in (moves or parse_pgn_moves(pgn)) if isinstance(move, str) and move.strip()]
    mistakes_count = 0
    blunders_count = 0
    queen_moves_seen = 0

    for ply, move in enumerate(parsed_moves, start=1):
        normalized = sanitize_move(move)
        if normalized.startswith("Q"):
            queen_moves_seen += 1

        severity = classify_move(move, ply, queen_moves_seen - 1)
        if severity == "blunder":
            blunders_count += 1
        elif severity == "mistake":
            mistakes_count += 1

    best_moves = suggest_best_moves(parsed_moves)
    summary = build_analysis_summary(len(parsed_moves), mistakes_count, blunders_count, best_moves)
    return AnalyzeGameResponse(
        summary=summary,
        mistakes_count=mistakes_count,
        blunders_count=blunders_count,
        best_moves=best_moves,
    )
