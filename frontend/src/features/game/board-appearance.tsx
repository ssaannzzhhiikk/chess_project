import type { CSSProperties, ReactNode } from "react";

export type PieceSkinName = "default" | "neon" | "minimal" | "glass";
export type BoardThemeName = "classic" | "dark" | "blue";

export type BoardAppearance = {
  pieceSkin: PieceSkinName;
  boardTheme: BoardThemeName;
};

export const defaultBoardAppearance: BoardAppearance = {
  pieceSkin: "default",
  boardTheme: "classic",
};

export const pieceSkinOptions: Array<{
  id: PieceSkinName;
  label: string;
  pro: boolean;
}> = [
  { id: "default", label: "Default", pro: false },
  { id: "neon", label: "Neon", pro: true },
  { id: "minimal", label: "Minimal", pro: true },
  { id: "glass", label: "Glass", pro: true },
];

export const boardThemeOptions: Array<{
  id: BoardThemeName;
  label: string;
}> = [
  { id: "classic", label: "Classic" },
  { id: "dark", label: "Dark" },
  { id: "blue", label: "Blue" },
];

const premiumPieceSkins = new Set<PieceSkinName>(["neon", "minimal", "glass"]);

const boardThemeStyles: Record<
  BoardThemeName,
  {
    lightSquare: string;
    darkSquare: string;
    frame: string;
  }
> = {
  classic: {
    lightSquare: "#efe2c7",
    darkSquare: "#6a4630",
    frame: "#1f2937",
  },
  dark: {
    lightSquare: "#475569",
    darkSquare: "#0f172a",
    frame: "#020617",
  },
  blue: {
    lightSquare: "#dbeafe",
    darkSquare: "#2563eb",
    frame: "#1d4ed8",
  },
};

const pieceGlyphs: Record<string, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

function renderPieceShell(children: ReactNode, svgStyle: CSSProperties | undefined, extraClassName: string) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center select-none ${extraClassName}`}
      style={{
        ...svgStyle,
        fontSize: "94%",
        lineHeight: 1,
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
}

function createCustomPieces(pieceSkin: Exclude<PieceSkinName, "default">) {
  return Object.fromEntries(
    Object.entries(pieceGlyphs).map(([piece, glyph]) => [
      piece,
      ({ svgStyle }: { svgStyle?: CSSProperties } = {}) => {
        const isWhite = piece.startsWith("w");

        if (pieceSkin === "minimal") {
          return renderPieceShell(
            <span>{glyph}</span>,
            svgStyle,
            isWhite
              ? "font-semibold text-slate-50 drop-shadow-[0_1px_1px_rgba(15,23,42,0.45)]"
              : "font-semibold text-slate-900 drop-shadow-[0_1px_1px_rgba(248,250,252,0.22)]",
          );
        }

        if (pieceSkin === "neon") {
          return renderPieceShell(
            <span>{glyph}</span>,
            svgStyle,
            isWhite
              ? "font-semibold text-cyan-200 [text-shadow:0_0_8px_rgba(34,211,238,0.65),0_0_18px_rgba(34,211,238,0.5)]"
              : "font-semibold text-fuchsia-200 [text-shadow:0_0_8px_rgba(232,121,249,0.68),0_0_18px_rgba(232,121,249,0.5)]",
          );
        }

        return renderPieceShell(
          <div
            className={`flex h-[92%] w-[92%] items-center justify-center rounded-[28%] border text-[0.98em] backdrop-blur-sm ${
              isWhite
                ? "border-white/55 bg-white/28 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_18px_rgba(15,23,42,0.22)]"
                : "border-slate-900/55 bg-slate-900/26 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_18px_rgba(15,23,42,0.26)]"
            }`}
          >
            {glyph}
          </div>,
          svgStyle,
          "",
        );
      },
    ]),
  );
}

export function getBoardThemeStyles(boardTheme: BoardThemeName) {
  return boardThemeStyles[boardTheme];
}

export function getCustomPieces(pieceSkin: PieceSkinName) {
  if (pieceSkin === "default") {
    return undefined;
  }

  return createCustomPieces(pieceSkin);
}

export function isPremiumPieceSkin(pieceSkin: PieceSkinName) {
  return premiumPieceSkins.has(pieceSkin);
}
