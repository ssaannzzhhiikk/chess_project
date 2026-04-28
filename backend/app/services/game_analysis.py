from __future__ import annotations

import re
from collections.abc import Sequence

import chess

from ..persistence_schemas import AnalyzeGameResponse, MoveReview


RESULT_MARKERS = {"1-0", "0-1", "1/2-1/2", "*"}
MOVE_NUMBER_PATTERN = re.compile(r"^\d+\.(?:\.\.)?$")
COMMENT_PATTERN = re.compile(r"\{[^}]*\}|\([^)]*\)")
TAG_PATTERN = re.compile(r"\[[^\]]*\]")
CENTER_SQUARES = {"d4", "e4", "d5", "e5"}
EXTENDED_CENTER_SQUARES = {"c3", "c4", "c5", "c6", "d3", "d6", "e3", "e6", "f3", "f4", "f5", "f6"}
WHITE_KNIGHT_STARTS = {chess.B1, chess.G1}
BLACK_KNIGHT_STARTS = {chess.B8, chess.G8}
WHITE_BISHOP_STARTS = {chess.C1, chess.F1}
BLACK_BISHOP_STARTS = {chess.C8, chess.F8}
SEVERITY_RANK = {"blunder": 3, "mistake": 2, "inaccuracy": 1, "best": 0}
PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
}


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


def score_move(board: chess.Board, move: chess.Move, ply: int) -> float:
    piece = board.piece_at(move.from_square)
    if piece is None:
        return float("-inf")

    target_square = chess.square_name(move.to_square)
    score = 0.0

    if board.is_capture(move):
        captured_value = 1
        if board.is_en_passant(move):
            captured_value = PIECE_VALUES[chess.PAWN]
        else:
            captured_piece = board.piece_at(move.to_square)
            if captured_piece is not None:
                captured_value = PIECE_VALUES.get(captured_piece.piece_type, 1)
        score += captured_value * 1.6

    if board.gives_check(move):
        score += 1.4

    if board.is_castling(move):
        score += 4.0

    if target_square in CENTER_SQUARES:
        score += 1.5
    elif target_square in EXTENDED_CENTER_SQUARES:
        score += 0.7

    if ply <= 16:
        if piece.piece_type == chess.PAWN and target_square in CENTER_SQUARES:
            score += 2.4
        if piece.piece_type == chess.KNIGHT:
            if (piece.color == chess.WHITE and move.from_square in WHITE_KNIGHT_STARTS) or (
                piece.color == chess.BLACK and move.from_square in BLACK_KNIGHT_STARTS
            ):
                score += 2.1
        if piece.piece_type == chess.BISHOP:
            if (piece.color == chess.WHITE and move.from_square in WHITE_BISHOP_STARTS) or (
                piece.color == chess.BLACK and move.from_square in BLACK_BISHOP_STARTS
            ):
                score += 1.8
        if piece.piece_type == chess.QUEEN and not board.is_capture(move):
            score -= 2.3
        if piece.piece_type == chess.KING and not board.is_castling(move):
            score -= 3.4
        if piece.piece_type == chess.PAWN and chess.square_file(move.to_square) in {0, 5, 7} and not board.is_capture(move):
            score -= 1.0

    board.push(move)
    try:
        if board.is_checkmate():
            score += 100.0
        if board.is_stalemate():
            score -= 0.4
        score -= board.legal_moves.count() * 0.02
    finally:
        board.pop()

    return score


def choose_best_move(board: chess.Board, ply: int) -> tuple[chess.Move, str, float]:
    legal_moves = list(board.legal_moves)
    scored_moves = [(score_move(board, move, ply), move) for move in legal_moves]
    best_score, best_move = max(scored_moves, key=lambda item: (item[0], item[1].uci()))
    return best_move, board.san(best_move), best_score


def classify_explicit_issue(move: str, ply: int, queen_moves_seen: int) -> tuple[str | None, str | None]:
    normalized = sanitize_move(move)

    if "??" in move:
        return "blunder", "The move annotation already marks this as a major tactical mistake."
    if "?" in move:
        return "mistake", "The move annotation suggests this was an avoidable inaccuracy."
    if ply <= 16 and normalized.startswith("K") and normalized not in {"O-O", "O-O-O"}:
        return "blunder", "Walking the king early usually creates immediate safety problems."
    if ply <= 12 and normalized.startswith("Q") and "+" not in move and "#" not in move:
        if queen_moves_seen > 0:
            return "blunder", "The queen is moving too early again, which usually loses time and coordination."
        return "mistake", "Bringing the queen out this early usually slows development."
    if ply <= 12 and normalized[0] in {"a", "h", "f"} and "x" not in normalized:
        return "mistake", "This flank pawn move spends a tempo without helping development much."
    return None, None


def classify_from_delta(delta: int, matched_best: bool) -> str:
    if matched_best or delta < 20:
        return "best"
    if delta >= 180:
        return "blunder"
    if delta >= 95:
        return "mistake"
    return "inaccuracy"


def build_review_summary(move: str, best_move: str, severity: str, explicit_reason: str | None) -> str:
    if severity == "best":
        return f"{move} is a solid choice here. It stays close to the strongest plan in the position."
    if explicit_reason:
        return f"{move} is flagged because {explicit_reason} A steadier move was {best_move}."
    if severity == "blunder":
        return f"{move} drops too much value in the position. {best_move} kept the game more under control."
    if severity == "mistake":
        return f"{move} is playable, but it misses a cleaner plan. {best_move} was the stronger continuation."
    return f"{move} was close, but {best_move} fit the position a bit better."


def build_move_reviews(moves: Sequence[str]) -> list[MoveReview]:
    board = chess.Board()
    reviews: list[MoveReview] = []
    queen_moves_seen = 0

    for ply, move_text in enumerate(moves, start=1):
        move = move_text.strip()
        if not move:
            continue

        legal_moves = list(board.legal_moves)
        if not legal_moves:
            break

        best_move, best_san, best_score = choose_best_move(board, ply)

        try:
            actual_move = board.parse_san(move)
        except ValueError:
            continue

        actual_san = board.san(actual_move)
        actual_score = score_move(board, actual_move, ply)
        delta = int(max(0.0, best_score - actual_score) * 100)

        normalized = sanitize_move(actual_san)
        if normalized.startswith("Q"):
            queen_moves_seen += 1

        explicit_severity, explicit_reason = classify_explicit_issue(actual_san, ply, queen_moves_seen - 1)
        matched_best = actual_move == best_move or sanitize_move(actual_san) == sanitize_move(best_san)
        severity = explicit_severity or classify_from_delta(delta, matched_best)

        reviews.append(
            MoveReview(
                ply=ply,
                san=actual_san,
                best_move=best_san,
                severity=severity,
                evaluation=int(actual_score * 100),
                delta=delta,
                summary=build_review_summary(actual_san, best_san, severity, explicit_reason),
            )
        )

        board.push(actual_move)

    return reviews


def collect_best_moves(move_reviews: Sequence[MoveReview]) -> list[str]:
    ranked_reviews = sorted(
        move_reviews,
        key=lambda review: (-SEVERITY_RANK[review.severity], -review.delta, review.ply),
    )
    best_moves: list[str] = []

    for review in ranked_reviews:
        if review.best_move not in best_moves:
            best_moves.append(review.best_move)
        if len(best_moves) == 3:
            break

    if best_moves:
        return best_moves

    fallback: list[str] = []
    for review in move_reviews[:3]:
        if review.best_move not in fallback:
            fallback.append(review.best_move)
    return fallback or ["Nf3", "O-O", "Re1"]


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
    move_reviews = build_move_reviews(parsed_moves)
    mistakes_count = sum(1 for review in move_reviews if review.severity == "mistake")
    blunders_count = sum(1 for review in move_reviews if review.severity == "blunder")
    best_moves = collect_best_moves(move_reviews)
    summary = build_analysis_summary(len(move_reviews), mistakes_count, blunders_count, best_moves)

    return AnalyzeGameResponse(
        summary=summary,
        mistakes_count=mistakes_count,
        blunders_count=blunders_count,
        best_moves=best_moves,
        move_reviews=move_reviews,
    )
