export type ThemeMode = "light" | "dark";
export type GameMode = "local" | "ai" | "online";
export type GameResult = "white" | "black" | "draw";
export type InsightSeverity = "best" | "good" | "inaccuracy" | "mistake" | "blunder";
export type PlayerColor = "white" | "black";
export type OnlineRoomStatus = "waiting" | "active" | "finished";

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

export type MultiplayerRoomSnapshot = {
  roomId: string;
  currentFen: string;
  moves: string[];
  status: OnlineRoomStatus;
  assignedColor: PlayerColor | null;
  result: GameResult | null;
  pgn: string;
  persistedGameId: string | null;
  termination: string | null;
  lastMove: {
    source: string;
    target: string;
    san: string;
    playerColor: PlayerColor;
  } | null;
};
