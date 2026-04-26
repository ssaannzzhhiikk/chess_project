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
import { useStockfish } from "@/hooks/use-stockfish";
import { useChessSounds } from "@/hooks/use-chess-sounds";
import { classify, detectOpening, getCapturedPieces, outcome, statusLabel } from "./chess-helpers";
import type { CoachInsight, GameMode, StoredGame } from "./types";

const initialGame = new Chess();

async function explainMove(insight: CoachInsight, opening: string) {
  const response = await fetch("/api/coach/explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      san: insight.san,
      severity: insight.severity,
      bestMove: insight.bestMove,
      evaluation: insight.evaluation,
      delta: insight.delta,
      positionContext: `Opening: ${opening}. Move ${insight.ply}.`,
    }),
  });

  if (!response.ok) {
    throw new Error("Explanation failed.");
  }

  return (await response.json()) as { explanation: string };
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
    async (snapshot: StoredGame) => {
      if (!stockfishReady || snapshot.moves.length === 0) {
        updateProfileFromResult(snapshot.result, []);
        return snapshot;
      }

      setAnalysisBusy(true);
      try {
        const reviewGame = new Chess();
        const insights: CoachInsight[] = [];
        const maxPlies = Math.min(snapshot.moves.length, 12);

        for (let index = 0; index < maxPlies; index += 1) {
          const moverColor = reviewGame.turn();
          const before = await analyzePosition(reviewGame.fen(), 10);
          const applied = reviewGame.move(snapshot.moves[index]);
          if (!applied) {
            continue;
          }
          const after = await analyzePosition(reviewGame.fen(), 10);
          const delta = Math.abs(before.evaluation - after.evaluation);
          const matchesBestMove =
            `${applied.from}${applied.to}${applied.promotion ?? ""}` ===
            before.bestMove;

          insights.push({
            ply: index + 1,
            san: applied.san,
            bestMove: before.bestMove,
            evaluation:
              moverColor === "w" ? after.evaluation : -after.evaluation,
            delta,
            severity: classify(delta, matchesBestMove),
          });
        }

        const enriched = {
          ...snapshot,
          insights: insights
            .filter((insight) => insight.severity !== "best" && insight.severity !== "good")
            .sort((left, right) => right.delta - left.delta)
            .slice(0, 5),
        };

        updateProfileFromResult(snapshot.result, insights);
        setGameHistory((current) =>
          current.map((entry) => (entry.id === snapshot.id ? enriched : entry)),
        );
        return enriched;
      } finally {
        setAnalysisBusy(false);
      }
    },
    [analyzePosition, stockfishReady, updateProfileFromResult],
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
      await analyzeCompletedGame(finished);
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
    if (!selectedReplay || !profile.isPro) {
      return;
    }

    const targetInsight = selectedReplay.insights[0];
    if (!targetInsight || targetInsight.explanation) {
      return;
    }

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
  }, [profile.isPro, selectedReplay]);

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
    makeMove,
    handleSquareClick,
    undoMove,
    resetBoard,
    resignGame,
    connectRoom,
    requestExplanation,
  };
}
