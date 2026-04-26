"use client";

import dynamic from "next/dynamic";

const Chessboard = dynamic(
  () => import("react-chessboard").then((module) => module.Chessboard),
  { ssr: false },
);

export function ChessBoard({
  fen,
  orientation,
  boardStyles,
  allowDragging,
  onPieceDrop,
  onSquareClick,
}: {
  fen: string;
  orientation: "white" | "black";
  boardStyles: Record<string, React.CSSProperties>;
  allowDragging: boolean;
  onPieceDrop: (source: string, target: string) => boolean;
  onSquareClick: (square: string) => void;
}) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
      <Chessboard
        options={{
          id: "main-board",
          position: fen,
          boardOrientation: orientation,
          allowDragging,
          showAnimations: true,
          animationDurationInMs: 180,
          darkSquareStyle: { backgroundColor: "#6a4630" },
          lightSquareStyle: { backgroundColor: "#efe2c7" },
          squareStyles: boardStyles,
          onSquareClick: ({ square }) => onSquareClick(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false,
        }}
      />
    </div>
  );
}

