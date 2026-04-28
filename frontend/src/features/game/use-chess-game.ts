"use client";

import { Chess, type Square } from "chess.js";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { defaultProfile, type Profile } from "@/lib/mock-data";
import { clearPendingReplay, readPendingReplay } from "@/lib/replay";
import { readStorage, writeStorage } from "@/lib/storage";
import {
  analyzeGame,
  ApiError,
  type ApiGame,
  type ApiMoveReview,
  clearAuthSession,
  createMultiplayerRoom,
  explainCoachMove,
  getAuthToken,
  getAuthUserId,
  getGameAnalysis,
  getGames,
  getProfile,
  getScopedAppStorageKey,
  joinMultiplayerRoom,
  saveGame,
  type ApiMultiplayerRoom,
  type ApiRoomErrorEvent,
  type ApiRoomStateEvent,
  type ApiGameAnalysis,
  upgradeToPro,
} from "@/lib/api";
import { useStockfish } from "@/hooks/use-stockfish";
import { useChessSounds } from "@/hooks/use-chess-sounds";
import {
  defaultBoardAppearance,
  isPremiumPieceSkin,
  type BoardThemeName,
  type PieceSkinName,
} from "./board-appearance";
import { detectOpening, getCapturedPieces, outcome, statusLabel } from "./chess-helpers";
import type {
  CoachInsight,
  GameMode,
  MultiplayerRoomSnapshot,
  PlayerColor,
  StoredGame,
} from "./types";

const initialGame = new Chess();
const BOARD_APPEARANCE_STORAGE_KEY = "endgame-board-appearance";

function getBoardAppearanceStorageKey(userId: string | null) {
  return userId ? `${BOARD_APPEARANCE_STORAGE_KEY}:user:${userId}` : BOARD_APPEARANCE_STORAGE_KEY;
}

async function explainMove(insight: CoachInsight, opening: string) {
  const severity = insight.severity === "good" ? "best" : insight.severity;

  return explainCoachMove({
    san: insight.san,
    severity,
    best_move: insight.bestMove,
    evaluation: insight.evaluation,
    delta: insight.delta,
    position_context: `Opening: ${opening}. Move ${insight.ply}.`,
  });
}

function toApiGameMode(mode: GameMode): "ai" | "multiplayer" {
  return mode === "ai" ? "ai" : "multiplayer";
}

function toApiGameResult(result: "white" | "black" | "draw"): "win" | "loss" | "draw" {
  if (result === "white") {
    return "win";
  }
  if (result === "black") {
    return "loss";
  }
  return "draw";
}

function fromApiGameResult(result: string): "white" | "black" | "draw" {
  if (result === "win" || result === "white") {
    return "white";
  }
  if (result === "loss" || result === "black") {
    return "black";
  }
  return "draw";
}

const severityWeight: Record<ApiMoveReview["severity"], number> = {
  blunder: 3,
  mistake: 2,
  inaccuracy: 1,
  best: 0,
};

function mapAnalysisToInsights(analysis: ApiGameAnalysis): CoachInsight[] {
  const significantReviews = [...analysis.move_reviews]
    .filter((review) => review.severity !== "best")
    .sort(
      (left, right) =>
        severityWeight[right.severity] - severityWeight[left.severity] ||
        right.delta - left.delta ||
        left.ply - right.ply,
    );
  const reviews = significantReviews.length > 0 ? significantReviews : analysis.move_reviews.slice(0, 3);

  return reviews.map((review) => ({
    ply: review.ply,
    san: review.san,
    bestMove: review.best_move,
    evaluation: review.evaluation,
    delta: review.delta,
    severity: review.severity,
    summary: review.summary,
    coachExplained: false,
  }));
}

function mapApiGameToStoredGame(game: ApiGame, analysis: ApiGameAnalysis | null = null): StoredGame {
  return {
    id: game.id,
    createdAt: game.created_at,
    mode: game.mode === "multiplayer" ? "online" : "ai",
    result: fromApiGameResult(game.result),
    pgn: game.pgn,
    moves: game.moves,
    opening: game.opening ?? detectOpening(game.moves),
    insights: analysis ? mapAnalysisToInsights(analysis) : [],
  };
}

function mergeStoredGames(primary: StoredGame[], secondary: StoredGame[]): StoredGame[] {
  const merged = new Map<string, StoredGame>();

  [...primary, ...secondary].forEach((entry) => {
    const current = merged.get(entry.id);
    if (!current) {
      merged.set(entry.id, entry);
      return;
    }

    merged.set(entry.id, {
      ...entry,
      insights: current.insights.length > 0 ? current.insights : entry.insights,
    });
  });

  return [...merged.values()];
}

function mapRoomSnapshot(room: ApiMultiplayerRoom): MultiplayerRoomSnapshot {
  return {
    roomId: room.room_id,
    currentFen: room.current_fen,
    moves: room.moves,
    status: room.status,
    assignedColor: room.assigned_color,
    result: room.result,
    pgn: room.pgn,
    persistedGameId: room.persisted_game_id,
    termination: room.termination,
    lastMove: room.last_move
      ? {
          source: room.last_move.source,
          target: room.last_move.target,
          san: room.last_move.san,
          playerColor: room.last_move.player_color,
        }
      : null,
  };
}

function buildGameFromRoom(snapshot: MultiplayerRoomSnapshot) {
  const game = new Chess();
  snapshot.moves.forEach((move) => {
    game.move(move);
  });
  return game;
}

function isPlayersTurn(game: Chess, color: PlayerColor | null) {
  return color !== null && game.turn() === (color === "white" ? "w" : "b");
}

function safeAttemptMove(game: Chess, source: string, target: string) {
  try {
    return game.move({
      from: source as Square,
      to: target as Square,
      promotion: "q",
    });
  } catch {
    return null;
  }
}

function describeConnection(snapshot: MultiplayerRoomSnapshot) {
  const role = snapshot.assignedColor ? `as ${snapshot.assignedColor}` : "to room";

  if (snapshot.status === "waiting") {
    return `connected ${role} | waiting for opponent`;
  }
  if (snapshot.status === "finished") {
    return `finished ${role} | ${snapshot.result ?? "draw"}`;
  }
  return `connected ${role} | live game`;
}

export function useChessGame() {
  const chessRef = useRef(new Chess());
  const socketRef = useRef<WebSocket | null>(null);
  const roomStateRef = useRef<MultiplayerRoomSnapshot | null>(null);
  const finishedRoomRef = useRef<string | null>(null);
  const autoConnectRoomRef = useRef<string | null>(null);
  const assignedColorRef = useRef<PlayerColor | null>(null);
  const storageUserIdRef = useRef<string | null>(getAuthUserId());
  const { analyzePosition, ready: stockfishReady, error: stockfishError } =
    useStockfish();
  const { play } = useChessSounds();

  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [fen, setFen] = useState(initialGame.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [status, setStatus] = useState(statusLabel(initialGame));
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(11);
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [gameHistory, setGameHistory] = useState<StoredGame[]>([]);
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null);
  const [replayPly, setReplayPly] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [connectionState, setConnectionState] = useState("offline");
  const [roomCode, setRoomCode] = useState("");
  const [roomState, setRoomState] = useState<MultiplayerRoomSnapshot | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [captured, setCaptured] = useState(getCapturedPieces(initialGame));
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  const [pieceSkin, setPieceSkin] = useState<PieceSkinName>(defaultBoardAppearance.pieceSkin);
  const [boardTheme, setBoardTheme] = useState<BoardThemeName>(defaultBoardAppearance.boardTheme);

  const selectedReplay = useMemo(
    () => gameHistory.find((entry) => entry.id === selectedReplayId) ?? null,
    [gameHistory, selectedReplayId],
  );

  const replayFen = useMemo(() => {
    if (!selectedReplay) {
      return null;
    }

    const replayGame = new Chess();
    selectedReplay.moves.slice(0, replayPly).forEach((move) => {
      replayGame.move(move);
    });
    return replayGame.fen();
  }, [selectedReplay, replayPly]);
  const replayCaptured = useMemo(() => {
    if (!selectedReplay) {
      return null;
    }

    const replayGame = new Chess();
    selectedReplay.moves.slice(0, replayPly).forEach((move) => {
      replayGame.move(move);
    });
    return getCapturedPieces(replayGame);
  }, [selectedReplay, replayPly]);

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") {
      return `/game?mode=online&room=${encodeURIComponent(roomCode)}`;
    }

    return `${window.location.origin}/game?mode=online&room=${encodeURIComponent(roomCode)}`;
  }, [roomCode]);

  const boardStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    lastMoveSquares.forEach((square) => {
      styles[square] = {
        background:
          "radial-gradient(circle, rgba(241,161,95,0.34) 0%, rgba(241,161,95,0.14) 68%, transparent 70%)",
        boxShadow: "inset 0 0 0 2px rgba(241,161,95,0.35)",
      };
    });

    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 2px rgba(108,141,255,0.72)",
        backgroundColor: "rgba(108,141,255,0.16)",
      };
    }

    legalTargets.forEach((square) => {
      styles[square] = {
        background:
          "radial-gradient(circle, rgba(97,205,154,0.58) 0%, rgba(97,205,154,0.18) 32%, transparent 36%)",
      };
    });

    return styles;
  }, [lastMoveSquares, legalTargets, selectedSquare]);

  const onlineConnected = connectionState.startsWith("connected");
  const boardFen = replayMode && replayFen ? replayFen : fen;
  const displayMoves =
    replayMode && selectedReplay ? selectedReplay.moves.slice(0, replayPly) : moveHistory;
  const displayStatus =
    replayMode && selectedReplay
      ? `Replay review | ${replayPly}/${selectedReplay.moves.length} plies`
      : status;
  const displayCaptured = replayMode && replayCaptured ? replayCaptured : captured;

  const syncGameState = useCallback(() => {
    const activeGame = chessRef.current;
    setFen(activeGame.fen());
    setMoveHistory(activeGame.history());
    setStatus(statusLabel(activeGame));
    setCaptured(getCapturedPieces(activeGame));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
  }, []);

  const clearOnlineRoom = useCallback((nextConnectionState = "offline") => {
    socketRef.current?.close();
    socketRef.current = null;
    roomStateRef.current = null;
    assignedColorRef.current = null;
    finishedRoomRef.current = null;
    setRoomState(null);
    setConnectionState(nextConnectionState);
  }, []);

  const applyOnlineRoomSnapshot = useCallback(
    (snapshot: MultiplayerRoomSnapshot) => {
      const previousMoveCount = roomStateRef.current?.moves.length ?? 0;
      const synced = buildGameFromRoom(snapshot);

      chessRef.current = synced;
      roomStateRef.current = snapshot;
      setRoomState(snapshot);
      setRoomCode(snapshot.roomId);
      setConnectionState(describeConnection(snapshot));
      setLastMoveSquares(
        snapshot.lastMove ? [snapshot.lastMove.source, snapshot.lastMove.target] : [],
      );
      clearSelection();

      if (snapshot.assignedColor && assignedColorRef.current !== snapshot.assignedColor) {
        assignedColorRef.current = snapshot.assignedColor;
        setOrientation(snapshot.assignedColor);
      }

      syncGameState();

      if (snapshot.moves.length > previousMoveCount && snapshot.lastMove) {
        void play(synced.inCheck() ? "check" : "move");
      }
    },
    [clearSelection, play, syncGameState],
  );

  useEffect(() => {
    const storageUserId = getAuthUserId();
    storageUserIdRef.current = storageUserId;
    const storedProfile = readStorage<Profile>(
      getScopedAppStorageKey("profile", storageUserId),
      defaultProfile,
    );
    const storedHistory = readStorage<StoredGame[]>(
      getScopedAppStorageKey("history", storageUserId),
      [],
    );
    const storedAppearance = readStorage(
      getBoardAppearanceStorageKey(storageUserId),
      defaultBoardAppearance,
    );

    startTransition(() => {
      setProfile(storedProfile);
      setGameHistory(storedHistory);
      setSelectedReplayId(storedHistory[0]?.id ?? null);
      setReplayPly(storedHistory[0]?.moves.length ?? 0);
      setPieceSkin(storedAppearance.pieceSkin);
      setBoardTheme(storedAppearance.boardTheme);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeStorage(getScopedAppStorageKey("profile", storageUserIdRef.current), profile);
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeStorage(getScopedAppStorageKey("history", storageUserIdRef.current), gameHistory);
  }, [gameHistory, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(getBoardAppearanceStorageKey(storageUserIdRef.current), {
      pieceSkin,
      boardTheme,
    });
  }, [boardTheme, hydrated, pieceSkin]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const pendingReplay = readPendingReplay();
    if (!pendingReplay) {
      return;
    }

    const replayPayload =
      "replay" in pendingReplay
        ? pendingReplay
        : { replay: pendingReplay, ply: 0 };

    clearPendingReplay();
    queueMicrotask(() => {
      clearOnlineRoom();
      chessRef.current = new Chess();
      clearSelection();
      setLastMoveSquares([]);
      syncGameState();

      startTransition(() => {
        setGameMode("local");
        setReplayMode(true);
        setGameHistory((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === replayPayload.replay.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = replayPayload.replay;
            return next;
          }
          return [replayPayload.replay, ...current];
        });
        setSelectedReplayId(replayPayload.replay.id);
        setReplayPly(replayPayload.ply);
      });
    });
  }, [clearOnlineRoom, clearSelection, hydrated, syncGameState]);

  useEffect(() => {
    if (!hydrated || !getAuthToken()) {
      return;
    }

    let active = true;

    async function syncProfile() {
      try {
        const user = await getProfile();
        const persistedGames = await getGames();
        if (!active) {
          return;
        }

        const nextUserId = user.id;
        const previousUserId = storageUserIdRef.current;
        const backendHistory = persistedGames.map((game) => mapApiGameToStoredGame(game));

        if (previousUserId !== nextUserId) {
          storageUserIdRef.current = nextUserId;
          const nextProfile = readStorage<Profile>(
            getScopedAppStorageKey("profile", nextUserId),
            defaultProfile,
          );
          const nextHistory = readStorage<StoredGame[]>(
            getScopedAppStorageKey("history", nextUserId),
            [],
          );
          const nextAppearance = readStorage(
            getBoardAppearanceStorageKey(nextUserId),
            defaultBoardAppearance,
          );
          const mergedHistory = mergeStoredGames(nextHistory, backendHistory);
          const normalizedPieceSkin =
            !user.is_pro && isPremiumPieceSkin(nextAppearance.pieceSkin)
              ? defaultBoardAppearance.pieceSkin
              : nextAppearance.pieceSkin;

          startTransition(() => {
            setProfile({
              ...nextProfile,
              email: user.email,
              isPro: user.is_pro,
              xp: Math.max(nextProfile.xp, user.xp),
              wins: Math.max(nextProfile.wins, user.wins),
            });
            setGameHistory(mergedHistory);
            setSelectedReplayId(mergedHistory[0]?.id ?? null);
            setReplayPly(mergedHistory[0]?.moves.length ?? 0);
            setPieceSkin(normalizedPieceSkin);
            setBoardTheme(nextAppearance.boardTheme);
          });
          return;
        }

        setProfile((current) => ({
          ...current,
          email: user.email,
          isPro: user.is_pro,
          xp: Math.max(current.xp, user.xp),
          wins: Math.max(current.wins, user.wins),
        }));
        if (!user.is_pro && isPremiumPieceSkin(pieceSkin)) {
          setPieceSkin(defaultBoardAppearance.pieceSkin);
        }
        setGameHistory((current) => {
          return mergeStoredGames(current, backendHistory);
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAuthSession();
          storageUserIdRef.current = null;
          clearOnlineRoom();
          startTransition(() => {
            setProfile(defaultProfile);
            setGameHistory([]);
            setSelectedReplayId(null);
            setReplayPly(0);
            setPieceSkin(defaultBoardAppearance.pieceSkin);
            setBoardTheme(defaultBoardAppearance.boardTheme);
          });
          return;
        }
        console.error("Failed to sync profile", error);
      }
    }

    void syncProfile();

    return () => {
      active = false;
    };
  }, [clearOnlineRoom, hydrated, pieceSkin]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const mode = params.get("mode");
    if (!room) {
      return;
    }

    autoConnectRoomRef.current = room;
    startTransition(() => {
      setRoomCode(room);
      if (mode === "online") {
        setGameMode("online");
      }
    });
  }, [hydrated]);

  useEffect(
    () => () => {
      socketRef.current?.close();
    },
    [],
  );

  const updateProfileFromResult = useCallback(
    (
      wonBy: "white" | "black" | "draw",
      insights: CoachInsight[],
      playerColor: PlayerColor = "white",
    ) => {
      setProfile((current) => {
        const next = { ...current };
        let xpGain = 40;
        const playerWon = wonBy !== "draw" && wonBy === playerColor;
        const playerLost = wonBy !== "draw" && wonBy !== playerColor;

        if (playerWon) {
          next.wins += 1;
          next.rating += 14;
          xpGain += 20;
        } else if (playerLost) {
          next.losses += 1;
          next.rating = Math.max(800, next.rating - 10);
        } else {
          next.draws += 1;
          next.rating += 2;
          xpGain += 10;
        }

        const bestMoves = insights.filter((insight) => insight.severity === "best").length;
        if (next.wins > 0 && !next.achievements.includes("first-win")) {
          next.achievements = [...next.achievements, "first-win"];
        }
        if (
          playerWon &&
          insights.every((insight) => insight.severity !== "blunder") &&
          !next.achievements.includes("calm-finisher")
        ) {
          next.achievements = [...next.achievements, "calm-finisher"];
          xpGain += 15;
        }
        if (bestMoves >= 3 && !next.achievements.includes("strategist")) {
          next.achievements = [...next.achievements, "strategist"];
        }

        next.xp += xpGain;
        next.level = Math.floor(next.xp / 120) + 1;
        next.streak = playerWon ? next.streak + 1 : 0;
        return next;
      });
    },
    [],
  );

  const analyzeCompletedGame = useCallback(
    async (
      snapshot: StoredGame,
      persistedId?: string,
      playerColor: PlayerColor = "white",
    ) => {
      if (!getAuthToken()) {
        updateProfileFromResult(snapshot.result, [], playerColor);
        return snapshot;
      }
      if (!profile.isPro) {
        updateProfileFromResult(snapshot.result, [], playerColor);
        return snapshot;
      }

      setAnalysisBusy(true);
      try {
        const analysis = await analyzeGame(
          persistedId
            ? { game_id: persistedId }
            : { pgn: snapshot.pgn },
        );
        const insights = mapAnalysisToInsights(analysis);

        const enriched = {
          ...snapshot,
          id: persistedId ?? snapshot.id,
          insights,
        };

        updateProfileFromResult(snapshot.result, insights, playerColor);
        setGameHistory((current) =>
          current.map((entry) => (entry.id === snapshot.id || entry.id === enriched.id ? enriched : entry)),
        );
        return enriched;
      } catch (error) {
        console.error("Failed to analyze game", error);
        updateProfileFromResult(snapshot.result, [], playerColor);
        return snapshot;
      } finally {
        setAnalysisBusy(false);
      }
    },
    [profile.isPro, updateProfileFromResult],
  );

  const loadReplayInsights = useCallback(
    async (replay: StoredGame) => {
      if (replay.insights.length > 0) {
        return replay;
      }
      if (!getAuthToken() || !profile.isPro) {
        return replay;
      }

      try {
        const analysis = await getGameAnalysis(replay.id);
        const enriched = {
          ...replay,
          insights: mapAnalysisToInsights(analysis),
        };
        setGameHistory((current) =>
          current.map((entry) => (entry.id === replay.id ? enriched : entry)),
        );
        return enriched;
      } catch {
        try {
          const analysis = await analyzeGame({ pgn: replay.pgn });
          const enriched = {
            ...replay,
            insights: mapAnalysisToInsights(analysis),
          };
          setGameHistory((current) =>
            current.map((entry) => (entry.id === replay.id ? enriched : entry)),
          );
          return enriched;
        } catch (fallbackError) {
          console.error("Failed to load replay insights", fallbackError);
          return replay;
        }
      }
    },
    [profile.isPro],
  );

  const finalizeGame = useCallback(
    async (resultOverride?: "white" | "black" | "draw") => {
      const activeGame = chessRef.current;
      const finished: StoredGame = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        createdAt: new Date().toISOString(),
        mode: gameMode,
        result: resultOverride ?? outcome(activeGame),
        pgn: activeGame.pgn(),
        moves: activeGame.history(),
        opening: detectOpening(activeGame.history()),
        insights: [],
      };

      setGameHistory((current) => [finished, ...current]);
      setSelectedReplayId(finished.id);
      setReplayPly(finished.moves.length);
      await play("end");
      let persisted = finished;
      let savedGameId: string | undefined;
      if (getAuthToken()) {
        try {
          const savedGame = await saveGame({
            pgn: finished.pgn,
            moves: finished.moves,
            result: toApiGameResult(finished.result),
            mode: toApiGameMode(finished.mode),
          });
          savedGameId = savedGame.id;
          persisted = { ...finished, id: savedGame.id };
          setGameHistory((current) =>
            current.map((entry) => (entry.id === finished.id ? persisted : entry)),
          );
          setSelectedReplayId(savedGame.id);
        } catch (error) {
          console.error("Failed to save game", error);
        }
      }
      await analyzeCompletedGame(persisted, savedGameId);
    },
    [analyzeCompletedGame, gameMode, play],
  );

  const playAiResponse = useCallback(async () => {
    const activeGame = chessRef.current;

    setAiThinking(true);
    try {
      const analysis = stockfishReady
        ? await analyzePosition(activeGame.fen(), difficulty)
        : null;
      const fallback = activeGame.moves({ verbose: true })[0];
      const bestMove = analysis?.bestMove;

      const responseMove = bestMove
        ? activeGame.move({
            from: bestMove.slice(0, 2) as Square,
            to: bestMove.slice(2, 4) as Square,
            promotion: (bestMove[4] as "q" | undefined) ?? "q",
          })
        : fallback
          ? activeGame.move(fallback.san)
          : null;

      if (responseMove) {
        setLastMoveSquares([responseMove.from, responseMove.to]);
        syncGameState();
        await play(responseMove.captured ? "capture" : activeGame.inCheck() ? "check" : "move");
      }

      if (activeGame.isGameOver()) {
        void finalizeGame();
      }
    } finally {
      setAiThinking(false);
    }
  }, [analyzePosition, difficulty, finalizeGame, play, stockfishReady, syncGameState]);

  const makeMove = useCallback(
    (source: string, target: string) => {
      if (aiThinking) {
        return false;
      }
      if (gameMode === "online" && !onlineConnected) {
        return false;
      }
      if (replayMode) {
        return false;
      }

      const activeGame = chessRef.current;
      const sourcePiece = activeGame.get(source as Square);

      if (!sourcePiece || sourcePiece.color !== activeGame.turn()) {
        clearSelection();
        return false;
      }

      if (gameMode === "online") {
        const assignedColor = roomStateRef.current?.assignedColor ?? null;
        if (!isPlayersTurn(activeGame, assignedColor)) {
          clearSelection();
          return false;
        }

        if (sourcePiece.color !== (assignedColor === "white" ? "w" : "b")) {
          clearSelection();
          return false;
        }

        const probe = safeAttemptMove(activeGame, source, target);
        if (!probe) {
          clearSelection();
          return false;
        }

        activeGame.undo();
        clearSelection();
        socketRef.current?.send(
          JSON.stringify({
            type: "move",
            source,
            target,
            promotion: "q",
          }),
        );
        return false;
      }

      const moved = safeAttemptMove(activeGame, source, target);

      if (!moved) {
        clearSelection();
        return false;
      }

      setLastMoveSquares([moved.from, moved.to]);
      clearSelection();
      syncGameState();
      void play(moved.captured ? "capture" : activeGame.inCheck() ? "check" : "move");

      if (activeGame.isGameOver()) {
        void finalizeGame();
        return true;
      }

      if (gameMode === "ai" && activeGame.turn() === "b") {
        void playAiResponse();
      }

      return true;
    },
    [
      aiThinking,
      clearSelection,
      finalizeGame,
      gameMode,
      onlineConnected,
      play,
      playAiResponse,
      replayMode,
      syncGameState,
    ],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      const activeGame = chessRef.current;
      const assignedColor = roomStateRef.current?.assignedColor ?? null;

      if (replayMode) {
        clearSelection();
        return;
      }

      if (selectedSquare && legalTargets.includes(square)) {
        void makeMove(selectedSquare, square);
        return;
      }

      if (gameMode === "online" && !isPlayersTurn(activeGame, assignedColor)) {
        clearSelection();
        return;
      }

      const piece = activeGame.get(square as Square);
      if (!piece || piece.color !== activeGame.turn()) {
        clearSelection();
        return;
      }

      setSelectedSquare(square);
      setLegalTargets(
        activeGame
          .moves({ square: square as Square, verbose: true })
          .map((move) => move.to),
      );
    },
    [clearSelection, gameMode, legalTargets, makeMove, replayMode, selectedSquare],
  );

  const undoMove = useCallback(() => {
    if (gameMode === "online" || replayMode) {
      return;
    }

    chessRef.current.undo();
    if (gameMode === "ai") {
      chessRef.current.undo();
    }
    clearSelection();
    syncGameState();
  }, [clearSelection, gameMode, replayMode, syncGameState]);

  const resignGame = useCallback(() => {
    if (replayMode) {
      return;
    }

    if (gameMode === "online") {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "resign" }));
      }
      return;
    }

    void finalizeGame(chessRef.current.turn() === "w" ? "black" : "white");
    chessRef.current = new Chess();
    clearSelection();
    setLastMoveSquares([]);
    syncGameState();
  }, [clearSelection, finalizeGame, gameMode, replayMode, syncGameState]);

  const resetBoard = useCallback(
    (nextMode: GameMode = gameMode) => {
      if (gameMode === "online" || roomStateRef.current !== null) {
        clearOnlineRoom();
      }

      chessRef.current = new Chess();
      setGameMode(nextMode);
      setReplayMode(false);
      setLastMoveSquares([]);
      setSelectedReplayId(null);
      setReplayPly(0);
      clearSelection();
      syncGameState();
    },
    [clearOnlineRoom, clearSelection, gameMode, syncGameState],
  );

  const openReplay = useCallback(
    (replayId: string, ply?: number) => {
      const targetReplay = gameHistory.find((entry) => entry.id === replayId);
      if (!targetReplay) {
        return;
      }

      clearOnlineRoom();
      chessRef.current = new Chess();
      clearSelection();
      setLastMoveSquares([]);
      syncGameState();

      startTransition(() => {
        setGameMode("local");
        setReplayMode(true);
        setSelectedReplayId(replayId);
        setReplayPly(ply ?? 0);
      });

      if (targetReplay.insights.length === 0) {
        void loadReplayInsights(targetReplay);
      }
    },
    [clearOnlineRoom, clearSelection, gameHistory, loadReplayInsights, syncGameState],
  );

  const stepReplayBackward = useCallback(() => {
    if (!replayMode || !selectedReplay) {
      return;
    }

    clearSelection();
    setReplayPly((current) => Math.max(0, current - 1));
  }, [clearSelection, replayMode, selectedReplay]);

  const stepReplayForward = useCallback(() => {
    if (!replayMode || !selectedReplay) {
      return;
    }

    clearSelection();
    setReplayPly((current) => Math.min(selectedReplay.moves.length, current + 1));
  }, [clearSelection, replayMode, selectedReplay]);

  const openRoomSocket = useCallback(
    (snapshot: MultiplayerRoomSnapshot) => {
      const token = getAuthToken();
      if (!token) {
        setConnectionState("sign in to join room");
        return;
      }

      const wsUrl =
        process.env.NEXT_PUBLIC_CHESS_WS_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http/, "ws");
      if (!wsUrl) {
        setConnectionState("configure NEXT_PUBLIC_CHESS_WS_URL");
        return;
      }

      clearOnlineRoom("connecting");
      applyOnlineRoomSnapshot(snapshot);
      setConnectionState("connecting");

      const socket = new WebSocket(
        `${wsUrl.replace(/\/$/, "")}/ws/games/${snapshot.roomId}?token=${encodeURIComponent(token)}`,
      );
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          return;
        }
        const currentSnapshot = roomStateRef.current;
        setConnectionState(currentSnapshot ? describeConnection(currentSnapshot) : "connected");
      };
      socket.onclose = () => {
        if (socketRef.current !== socket) {
          return;
        }
        socketRef.current = null;
        const currentSnapshot = roomStateRef.current;
        if (currentSnapshot?.status === "finished") {
          setConnectionState(describeConnection(currentSnapshot));
          return;
        }
        setConnectionState("disconnected");
      };
      socket.onerror = () => {
        if (socketRef.current !== socket) {
          return;
        }
        setConnectionState("error");
      };
      socket.onmessage = (event) => {
        if (socketRef.current !== socket) {
          return;
        }
        const payload = JSON.parse(event.data) as ApiRoomStateEvent | ApiRoomErrorEvent;
        if (payload.type === "error") {
          setConnectionState(`error | ${payload.message}`);
          return;
        }
        applyOnlineRoomSnapshot(mapRoomSnapshot(payload.room));
      };
    },
    [applyOnlineRoomSnapshot, clearOnlineRoom],
  );

  const createRoom = useCallback(async () => {
    if (!getAuthToken()) {
      setConnectionState("sign in to create room");
      return;
    }

    try {
      const room = await createMultiplayerRoom();
      const snapshot = mapRoomSnapshot(room);
      autoConnectRoomRef.current = null;
      setGameMode("online");
      openRoomSocket(snapshot);
    } catch (error) {
      if (error instanceof ApiError) {
        setConnectionState(`error | ${error.message}`);
      } else {
        setConnectionState("unable to create room");
      }
    }
  }, [openRoomSocket]);

  const connectRoom = useCallback(async () => {
    const trimmedRoomCode = roomCode.trim();
    if (!trimmedRoomCode) {
      setConnectionState("enter room code");
      return;
    }
    if (!getAuthToken()) {
      setConnectionState("sign in to join room");
      return;
    }

    try {
      const room = await joinMultiplayerRoom(trimmedRoomCode);
      const snapshot = mapRoomSnapshot(room);
      autoConnectRoomRef.current = null;
      openRoomSocket(snapshot);
    } catch (error) {
      if (error instanceof ApiError) {
        setConnectionState(`error | ${error.message}`);
      } else {
        setConnectionState("unable to join room");
      }
    }
  }, [openRoomSocket, roomCode]);

  useEffect(() => {
    const targetRoom = autoConnectRoomRef.current;
    if (
      !hydrated ||
      !targetRoom ||
      gameMode !== "online" ||
      roomCode !== targetRoom ||
      socketRef.current !== null
    ) {
      return;
    }

    if (!getAuthToken()) {
      return;
    }

    autoConnectRoomRef.current = null;
    queueMicrotask(() => {
      void connectRoom();
    });
  }, [connectRoom, gameMode, hydrated, roomCode]);

  useEffect(() => {
    if (!roomState || roomState.status !== "finished" || finishedRoomRef.current === roomState.roomId) {
      return;
    }

    finishedRoomRef.current = roomState.roomId;

    const finishedSnapshot: StoredGame = {
      id: roomState.persistedGameId ?? `${roomState.roomId}-finished`,
      createdAt: new Date().toISOString(),
      mode: "online",
      result: roomState.result ?? "draw",
      pgn: roomState.pgn,
      moves: roomState.moves,
      opening: detectOpening(roomState.moves),
      insights: [],
    };

    queueMicrotask(() => {
      setGameHistory((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === finishedSnapshot.id);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = finishedSnapshot;
          return next;
        }
        return [finishedSnapshot, ...current];
      });
      setSelectedReplayId(finishedSnapshot.id);
      setReplayPly(finishedSnapshot.moves.length);

      if (roomState.persistedGameId && getAuthToken() && profile.isPro) {
        void analyzeCompletedGame(
          finishedSnapshot,
          roomState.persistedGameId,
          roomState.assignedColor ?? "white",
        );
      } else {
        updateProfileFromResult(finishedSnapshot.result, [], roomState.assignedColor ?? "white");
      }
    });
  }, [analyzeCompletedGame, profile.isPro, roomState, updateProfileFromResult]);

  const requestExplanation = useCallback(async () => {
    if (!selectedReplay) {
      return;
    }

    if (!profile.isPro) {
      setUpgradeError(null);
      setUpgradeModalOpen(true);
      return;
    }

    const replayWithInsights =
      selectedReplay.insights.length > 0
        ? selectedReplay
        : await loadReplayInsights(selectedReplay);

    const targetInsight =
      replayWithInsights.insights.find(
        (insight) => !insight.coachExplained && insight.severity !== "best",
      ) ??
      replayWithInsights.insights.find((insight) => !insight.coachExplained) ??
      null;
    if (!targetInsight || targetInsight.coachExplained) {
      return;
    }

    try {
      const response = await explainMove(targetInsight, replayWithInsights.opening);
      setGameHistory((current) =>
        current.map((entry) =>
          entry.id === replayWithInsights.id
            ? {
                ...entry,
                insights: entry.insights.map((insight) =>
                  insight.ply === targetInsight.ply && insight.san === targetInsight.san
                    ? {
                        ...insight,
                        explanation: response.explanation,
                        coachExplained: true,
                      }
                    : insight,
                ),
              }
            : entry,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setUpgradeError(null);
        setUpgradeModalOpen(true);
        return;
      }
      console.error("Failed to request explanation", error);
    }
  }, [loadReplayInsights, profile.isPro, selectedReplay]);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeError(null);
  }, []);

  const openUpgradeModal = useCallback(() => {
    setUpgradeError(null);
    setUpgradeModalOpen(true);
  }, []);

  const requestPieceSkin = useCallback(
    (nextPieceSkin: PieceSkinName) => {
      if (nextPieceSkin === pieceSkin) {
        return;
      }
      if (isPremiumPieceSkin(nextPieceSkin) && !profile.isPro) {
        openUpgradeModal();
        return;
      }
      setPieceSkin(nextPieceSkin);
    },
    [openUpgradeModal, pieceSkin, profile.isPro],
  );

  const requestBoardTheme = useCallback((nextBoardTheme: BoardThemeName) => {
    setBoardTheme(nextBoardTheme);
  }, []);

  const handleUpgrade = useCallback(async () => {
    setUpgradeBusy(true);
    setUpgradeError(null);
    try {
      const response = await upgradeToPro();
      setProfile((current) => ({
        ...current,
        email: response.user.email,
        isPro: response.user.is_pro,
        xp: Math.max(current.xp, response.user.xp),
        wins: Math.max(current.wins, response.user.wins),
      }));
      setUpgradeModalOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setUpgradeError(error.message);
      } else {
        setUpgradeError("Unable to upgrade right now.");
      }
    } finally {
      setUpgradeBusy(false);
    }
  }, []);

  return {
    profile,
    setProfile,
    fen,
    boardFen,
    moveHistory,
    displayMoves,
    status,
    displayStatus,
    orientation,
    setOrientation,
    pieceSkin,
    boardTheme,
    difficulty,
    setDifficulty,
    gameMode,
    setGameMode,
    gameHistory,
    selectedReplayId,
    setSelectedReplayId,
    replayPly,
    setReplayPly,
    replayFen,
    replayMode,
    selectedReplay,
    aiThinking,
    analysisBusy,
    connectionState,
    onlineConnected,
    roomCode,
    setRoomCode,
    roomState,
    inviteLink,
    stockfishReady,
    stockfishError,
    boardStyles,
    captured,
    displayCaptured,
    hydrated,
    upgradeModalOpen,
    upgradeBusy,
    upgradeError,
    makeMove,
    handleSquareClick,
    undoMove,
    resetBoard,
    resignGame,
    openReplay,
    stepReplayBackward,
    stepReplayForward,
    createRoom,
    connectRoom,
    requestExplanation,
    requestPieceSkin,
    requestBoardTheme,
    openUpgradeModal,
    closeUpgradeModal,
    handleUpgrade,
  };
}
