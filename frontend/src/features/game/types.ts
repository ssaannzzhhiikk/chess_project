export type ThemeMode = "light" | "dark";
export type GameMode = "local" | "ai" | "online";
export type GameResult = "white" | "black" | "draw";
export type InsightSeverity = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type CoachInsight = {
  ply: number;
  san: string;
  bestMove: string;
  evaluation: number;
  delta: number;
  severity: InsightSeverity;
  explanation?: string;
};

export type StoredGame = {
  id: string;
  createdAt: string;
  mode: GameMode;
  result: GameResult;
  pgn: string;
  moves: string[];
  opening: string;
  insights: CoachInsight[];
};

