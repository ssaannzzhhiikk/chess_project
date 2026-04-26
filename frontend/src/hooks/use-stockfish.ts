"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StockfishAnalysis = {
  bestMove: string;
  evaluation: number;
  pv: string[];
};

type PendingRequest = {
  resolve: (value: StockfishAnalysis) => void;
  reject: (reason?: unknown) => void;
  evaluation: number;
  pv: string[];
};

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish.js");
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = `${event.data}`.trim();

      if (line === "readyok") {
        setReady(true);
        return;
      }

      if (line.includes("score")) {
        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)$/);

        if (pendingRef.current && scoreMatch) {
          const [, kind, rawValue] = scoreMatch;
          const parsed = Number(rawValue);
          pendingRef.current.evaluation =
            kind === "mate" ? parsed * 1000 : parsed;
        }

        if (pendingRef.current && pvMatch) {
          pendingRef.current.pv = pvMatch[1].split(" ");
        }
      }

      if (line.startsWith("bestmove ")) {
        const match = line.match(/^bestmove\s+(\S+)/);
        const bestMove = match?.[1];

        if (pendingRef.current && bestMove) {
          pendingRef.current.resolve({
            bestMove,
            evaluation: pendingRef.current.evaluation,
            pv: pendingRef.current.pv,
          });
          pendingRef.current = null;
        }
      }
    };

    worker.onerror = () => {
      setError("Stockfish failed to load.");
    };

    worker.postMessage("uci");
    worker.postMessage("isready");

    return () => {
      if (pendingRef.current) {
        pendingRef.current.reject(new Error("Stockfish worker disposed."));
      }
      worker.terminate();
    };
  }, []);

  const analyzePosition = useCallback(
    (fen: string, depth = 12) =>
      new Promise<StockfishAnalysis>((resolve, reject) => {
        const worker = workerRef.current;

        if (!worker) {
          reject(new Error("Stockfish worker is unavailable."));
          return;
        }

        if (pendingRef.current) {
          reject(new Error("Stockfish is busy."));
          return;
        }

        pendingRef.current = {
          resolve,
          reject,
          evaluation: 0,
          pv: [],
        };

        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
      }),
    [],
  );

  return {
    ready,
    error,
    analyzePosition,
  };
}

