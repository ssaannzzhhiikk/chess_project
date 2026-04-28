import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
const AUTH_TOKEN_KEY = "endgame-auth-token";

export type ApiUser = {
  id: string;
  email: string;
  is_pro: boolean;
  xp: number;
  wins: number;
  created_at: string;
};

export type ApiAuthResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

export type ApiLeaderboardEntry = {
  username: string;
  city: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  level: number;
};

export type ApiGame = {
  id: string;
  user_id: string;
  mode: string;
  result: string;
  pgn: string;
  moves: string[];
  opening?: string | null;
  city?: string;
  created_at: string;
};

export type ApiGameAnalysis = {
  id?: string;
  game_id?: string;
  summary: string;
  mistakes_count: number;
  blunders_count: number;
  best_moves: string[];
};

export type ApiCoachExplanation = {
  explanation: string;
};

export type ApiUpgradeResponse = {
  message: string;
  user: ApiUser;
};

export type ApiRoomMoveSummary = {
  source: string;
  target: string;
  san: string;
  player_id: string;
  player_color: "white" | "black";
};

export type ApiMultiplayerRoom = {
  room_id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  current_fen: string;
  moves: string[];
  status: "waiting" | "active" | "finished";
  disconnected_players: string[];
  assigned_color: "white" | "black" | null;
  last_move?: ApiRoomMoveSummary | null;
  result: "white" | "black" | "draw" | null;
  pgn: string;
  persisted_game_id: string | null;
  termination: string | null;
};

export type ApiRoomStateEvent = {
  type: "room_state";
  room: ApiMultiplayerRoom;
};

export type ApiRoomErrorEvent = {
  type: "error";
  message: string;
};

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getAuthToken() {
  return readStorage<string | null>(AUTH_TOKEN_KEY, null);
}

export function setAuthToken(token: string) {
  writeStorage(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  removeStorage(AUTH_TOKEN_KEY);
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, headers, ...init } = options;
  const token = getAuthToken();
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Content-Type") && init.body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      message = response.statusText || message;
    }

    if (response.status === 401) {
      clearAuthToken();
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  return apiRequest<ApiAuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile() {
  return apiRequest<ApiUser>("/auth/me", { auth: true });
}

export async function getLeaderboard() {
  return apiRequest<ApiLeaderboardEntry[]>("/leaderboard");
}

export async function getGames() {
  return apiRequest<ApiGame[]>("/games", { auth: true });
}

export async function saveGame(payload: {
  pgn: string;
  moves: string[];
  result: "win" | "loss" | "draw";
  mode: "ai" | "multiplayer";
}) {
  return apiRequest<ApiGame>("/games", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function analyzeGame(payload: { game_id?: string; pgn?: string }) {
  return apiRequest<ApiGameAnalysis>("/analyze-game", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getGameAnalysis(gameId: string) {
  return apiRequest<ApiGameAnalysis>(`/games/${gameId}/analysis`, {
    auth: true,
  });
}

export async function explainCoachMove(payload: {
  san: string;
  severity: "best" | "inaccuracy" | "mistake" | "blunder";
  best_move: string;
  evaluation: number;
  delta: number;
  position_context: string;
}) {
  return apiRequest<ApiCoachExplanation>("/coach/explain", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function upgradeToPro() {
  return apiRequest<ApiUpgradeResponse>("/upgrade", {
    method: "POST",
    auth: true,
  });
}

export async function createMultiplayerRoom() {
  return apiRequest<ApiMultiplayerRoom>("/multiplayer/rooms", {
    method: "POST",
    auth: true,
  });
}

export async function joinMultiplayerRoom(roomId: string) {
  return apiRequest<ApiMultiplayerRoom>(`/multiplayer/rooms/${roomId}/join`, {
    method: "POST",
    auth: true,
  });
}
