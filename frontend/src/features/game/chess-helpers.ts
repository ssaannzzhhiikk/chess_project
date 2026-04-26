import { Chess } from "chess.js";

import type { GameResult, InsightSeverity } from "./types";

export const openingLibrary: Array<{ pattern: string[]; name: string }> = [
  { pattern: ["e4", "e5", "Nf3", "Nc6", "Bb5"], name: "Ruy Lopez" },
  { pattern: ["e4", "c5"], name: "Sicilian Defense" },
  { pattern: ["d4", "d5", "c4"], name: "Queen's Gambit" },
  { pattern: ["e4", "e5", "Nf3", "Nc6", "Bc4"], name: "Italian Game" },
];

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

export function statusLabel(game: Chess) {
  if (game.isCheckmate()) {
    return `Checkmate. ${game.turn() === "w" ? "Black" : "White"} wins.`;
  }

  if (game.isStalemate()) {
    return "Stalemate.";
  }

  if (game.isThreefoldRepetition()) {
    return "Threefold repetition draw.";
  }

  if (game.isInsufficientMaterial()) {
    return "Draw by insufficient material.";
  }

  if (game.isDraw()) {
    return "Draw.";
  }

  return `${game.turn() === "w" ? "White" : "Black"} to move${
    game.inCheck() ? " and in check" : ""
  }.`;
}

export function outcome(game: Chess): GameResult {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "black" : "white";
  }

  return "draw";
}

export function detectOpening(moves: string[]) {
  const prefix = moves.slice(0, 5);
  const match = openingLibrary.find((candidate) =>
    candidate.pattern.every((move, index) => prefix[index] === move),
  );
  return match?.name ?? "Original Setup";
}

export function classify(delta: number, matchesBestMove: boolean): InsightSeverity {
  if (matchesBestMove) {
    return "best";
  }

  if (delta >= 180) {
    return "blunder";
  }

  if (delta >= 95) {
    return "mistake";
  }

  if (delta >= 45) {
    return "inaccuracy";
  }

  return "good";
}

export function getCapturedPieces(game: Chess) {
  const remaining = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.type === "k") {
        continue;
      }
      remaining[piece.color][piece.type] += 1;
    }
  }

  const starting = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  (Object.keys(starting) as Array<keyof typeof starting>).forEach((type) => {
    const blackMissing = starting[type] - remaining.b[type];
    const whiteMissing = starting[type] - remaining.w[type];

    for (let index = 0; index < blackMissing; index += 1) {
      whiteCaptured.push(type);
    }
    for (let index = 0; index < whiteMissing; index += 1) {
      blackCaptured.push(type);
    }
  });

  const score = whiteCaptured.reduce((sum, piece) => sum + pieceValues[piece], 0) -
    blackCaptured.reduce((sum, piece) => sum + pieceValues[piece], 0);

  return {
    whiteCaptured,
    blackCaptured,
    score,
  };
}

export function formatPiece(piece: string) {
  const glyphMap: Record<string, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
  };

  return glyphMap[piece] ?? piece;
}

