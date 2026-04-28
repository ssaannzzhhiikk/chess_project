"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import {
  getBoardThemeStyles,
  getCustomPieces,
  type BoardThemeName,
  type PieceSkinName,
} from "@/features/game/board-appearance";

const Chessboard = dynamic(
  () => import("react-chessboard").then((module) => module.Chessboard),
  { ssr: false },
);

export function ChessBoard({
  fen,
  orientation,
  boardStyles,
  boardTheme = "classic",
  pieceSkin = "default",
  allowDragging,
  onPieceDrop,
  onSquareClick,
}: {
  fen: string;
  orientation: "white" | "black";
  boardStyles: Record<string, React.CSSProperties>;
  boardTheme?: BoardThemeName;
  pieceSkin?: PieceSkinName;
  allowDragging: boolean;
  onPieceDrop: (source: string, target: string) => boolean;
  onSquareClick: (square: string) => void;
}) {
  const themeStyles = getBoardThemeStyles(boardTheme);
  const customPieces = useMemo(() => getCustomPieces(pieceSkin), [pieceSkin]);

  return (
    <div
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]"
      style={{
        boxShadow: `0 18px 36px color-mix(in srgb, ${themeStyles.frame} 18%, transparent)`,
      }}
    >
      <Chessboard
        options={{
          id: "main-board",
          pieces: customPieces,
          position: fen,
          boardOrientation: orientation,
          allowDragging,
          showAnimations: true,
          animationDurationInMs: 180,
          darkSquareStyle: { backgroundColor: themeStyles.darkSquare },
          lightSquareStyle: { backgroundColor: themeStyles.lightSquare },
          squareStyles: boardStyles,
          onSquareClick: ({ square }) => onSquareClick(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false,
        }}
      />
    </div>
  );
}
