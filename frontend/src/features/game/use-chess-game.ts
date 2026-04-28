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

import { defaultProfile, type Profile, appStorageKeys } from "@/lib/mock-data";
import { readStorage, writeStorage } from "@/lib/storage";
import {
  analyzeGame,
  ApiError,
  explainCoachMove,
  getAuthToken,
  getProfile,
  saveGame,
  type ApiGameAnalysis,
  upgradeToPro,
} from "@/lib/api";
import { useStockfish } from "@/hooks/use-stockfish";
import { useChessSounds } from "@/hooks/use-chess-sounds";
import { detectOpening, getCapturedPieces, outcome, statusLabel } from "./chess-helpers";
import type { CoachInsight, GameMode, StoredGame } from "./types";

const initialGame = new Chess();

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

function mapAnalysisToInsights(analysis: ApiGameAnalysis): CoachInsight[] {
  const severity =
    analysis.blunders_count > 0
      ? "blunder"
      : analysis.mistakes_count > 0
        ? "mistake"
        : "best";

  return [
    {
      ply: 1,
      san: "Game review",
      bestMove: analysis.best_moves[0] ?? "No suggestion",
      evaluation: Math.max(0, analysis.best_moves.length * 10),
      delta: analysis.blunders_count * 100 + analysis.mistakes_count * 40,
      severity,
      explanation: analysis.summary,
    },
  ];
}

export function useChessGame() {
  const chessRef = useRef(new Chess());
  const socketRef = useRef<WebSocket | null>(null);
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
  const [roomCode, setRoomCode] = useState("rook-room");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [captured, setCaptured] = useState(getCapturedPieces(initialGame));
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") {
      return `/?mode=online&room=${encodeURIComponent(roomCode)}`;
    }

    return `${window.location.origin}/play?mode=online&room=${encodeURIComponent(roomCode)}`;
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

  useEffect(() => {
    const storedProfile = readStorage<Profile>(
      appStorageKeys.profile,
      defaultProfile,
    );
    const storedHistory = readStorage<StoredGame[]>(appStorageKeys.history, []);

    startTransition(() => {
      setProfile(storedProfile);
      setGameHistory(storedHistory);
      setSelectedReplayId(storedHistory[0]?.id ?? null);
      setReplayPly(storedHistory[0]?.moves.length ?? 0);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeStorage(appStorageKeys.profile, profile);
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeStorage(appStorageKeys.history, gameHistory);
  }, [gameHistory, hydrated]);

  useEffect(() => {
    if (!hydrated || !getAuthToken()) {
      return;
    }

    let active = true;

    async function syncProfile() {
      try {
        const user = await getProfile();
        if (!active) {
          return;
        }

        setProfile((current) => ({
          ...current,
          email: user.email,
          isPro: user.is_pro,
          xp: Math.max(current.xp, user.xp),
          wins: Math.max(current.wins, user.wins),
        }));
      } catch (error) {
        console.error("Failed to sync profile", error);
      }
    }

    void syncProfile();

    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(
    () => () => {
      socketRef.current?.close();
    },
    [],
  );

  const updateProfileFromResult = useCallback(
    (wonBy: "white" | "black" | "draw", insights: CoachInsight[]) => {
      setProfile((current) => {
        const next = { ...current };
        let xpGain = 40;

        if (wonBy === "white") {
          next.wins += 1;
          next.rating += 14;
          xpGain += 20;
        } else if (wonBy === "black") {
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
          wonBy === "white" &&
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
        next.streak = wonBy === "white" ? next.streak + 1 : 0;
        return next;
      });
    },
    [],
  );

  const analyzeCompletedGame = useCallback(
    async (snapshot: StoredGame, persistedId?: string) => {
      if (!getAuthToken()) {
        updateProfileFromResult(snapshot.result, []);
        return snapshot;
      }
      if (!profile.isPro) {
        updateProfileFromResult(snapshot.result, []);
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

        updateProfileFromResult(snapshot.result, insights);
        setGameHistory((current) =>
          current.map((entry) => (entry.id === snapshot.id || entry.id === enriched.id ? enriched : entry)),
        );
        return enriched;
      } catch (error) {
        console.error("Failed to analyze game", error);
        updateProfileFromResult(snapshot.result, []);
        return snapshot;
      } finally {
        setAnalysisBusy(false);
      }
    },
    [profile.isPro, updateProfileFromResult],
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
      if (gameMode === "online" && connectionState !== "connected") {
        return false;
      }

      const activeGame = chessRef.current;
      const moved = activeGame.move({
        from: source as Square,
        to: target as Square,
        promotion: "q",
      });

      if (!moved) {
        return false;
      }

      setLastMoveSquares([moved.from, moved.to]);
      clearSelection();
      syncGameState();
      void play(moved.captured ? "capture" : activeGame.inCheck() ? "check" : "move");

      if (gameMode === "online" && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            source,
            target,
            san: moved.san,
            fen: activeGame.fen(),
            pgn: activeGame.pgn(),
          }),
        );
      }

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
      connectionState,
      finalizeGame,
      gameMode,
      play,
      playAiResponse,
      syncGameState,
    ],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      const activeGame = chessRef.current;

      if (selectedSquare && legalTargets.includes(square)) {
        void makeMove(selectedSquare, square);
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
    [clearSelection, legalTargets, makeMove, selectedSquare],
  );

  const undoMove = useCallback(() => {
    if (gameMode === "online") {
      return;
    }

    chessRef.current.undo();
    if (gameMode === "ai") {
      chessRef.current.undo();
    }
    clearSelection();
    syncGameState();
  }, [clearSelection, gameMode, syncGameState]);

  const resignGame = useCallback(() => {
    void finalizeGame(chessRef.current.turn() === "w" ? "black" : "white");
    chessRef.current = new Chess();
    clearSelection();
    setLastMoveSquares([]);
    syncGameState();
  }, [clearSelection, finalizeGame, syncGameState]);

  const resetBoard = useCallback(
    (nextMode: GameMode = gameMode) => {
      chessRef.current = new Chess();
      setGameMode(nextMode);
      setLastMoveSquares([]);
      setSelectedReplayId(null);
      setReplayPly(0);
      clearSelection();
      syncGameState();
    },
    [clearSelection, gameMode, syncGameState],
  );

  const connectRoom = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_CHESS_WS_URL;
    if (!wsUrl) {
      setConnectionState("configure NEXT_PUBLIC_CHESS_WS_URL");
      return;
    }

    socketRef.current?.close();
    const socket = new WebSocket(
      `${wsUrl.replace(/\/$/, "")}/ws/games/${roomCode}`,
    );
    socketRef.current = socket;
    setConnectionState("connecting");

    socket.onopen = () => setConnectionState("connected");
    socket.onclose = () => setConnectionState("disconnected");
    socket.onerror = () => setConnectionState("error");
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { pgn: string };
      const synced = new Chess();
      synced.loadPgn(payload.pgn);
      chessRef.current = synced;
      syncGameState();
    };
  }, [roomCode, syncGameState]);

  const requestExplanation = useCallback(async () => {
    if (!selectedReplay) {
      return;
    }

    if (!profile.isPro) {
      setUpgradeError(null);
      setUpgradeModalOpen(true);
      return;
    }

    const targetInsight = selectedReplay.insights[0];
    if (!targetInsight || targetInsight.explanation) {
      return;
    }

    try {
      const response = await explainMove(targetInsight, selectedReplay.opening);
      setGameHistory((current) =>
        current.map((entry) =>
          entry.id === selectedReplay.id
            ? {
                ...entry,
                insights: entry.insights.map((insight, index) =>
                  index === 0
                    ? { ...insight, explanation: response.explanation }
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
  }, [profile.isPro, selectedReplay]);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeError(null);
  }, []);

  const openUpgradeModal = useCallback(() => {
    setUpgradeError(null);
    setUpgradeModalOpen(true);
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
    moveHistory,
    status,
    orientation,
    setOrientation,
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
    selectedReplay,
    aiThinking,
    analysisBusy,
    connectionState,
    roomCode,
    setRoomCode,
    inviteLink,
    stockfishReady,
    stockfishError,
    boardStyles,
    captured,
    hydrated,
    upgradeModalOpen,
    upgradeBusy,
    upgradeError,
    makeMove,
    handleSquareClick,
    undoMove,
    resetBoard,
    resignGame,
    connectRoom,
    requestExplanation,
    openUpgradeModal,
    closeUpgradeModal,
    handleUpgrade,
  };
}
