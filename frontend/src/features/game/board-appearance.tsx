import type { CSSProperties, JSX } from "react";

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

export const pieceSkinOptions = [
  { id: "default", label: "Default", pro: false },
  { id: "neon", label: "Neon", pro: true },
  { id: "minimal", label: "Minimal", pro: true },
  { id: "glass", label: "Glass", pro: true },
] satisfies Array<{ id: PieceSkinName; label: string; pro: boolean }>;

export const boardThemeOptions = [
  { id: "classic", label: "Classic" },
  { id: "dark", label: "Dark" },
  { id: "blue", label: "Blue" },
] satisfies Array<{ id: BoardThemeName; label: string }>;

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

const pieceTypes = ["K", "Q", "R", "B", "N", "P"] as const;
type PieceType = (typeof pieceTypes)[number];
type PieceCode = `w${PieceType}` | `b${PieceType}`;

function getPieceColors(pieceSkin: Exclude<PieceSkinName, "default">, isWhite: boolean) {
  if (pieceSkin === "neon") {
    return {
      fill: isWhite ? "#cffafe" : "#f5d0fe",
      stroke: isWhite ? "#22d3ee" : "#e879f9",
      accent: isWhite ? "#67e8f9" : "#f0abfc",
      shadow: isWhite
        ? "drop-shadow(0 0 7px rgba(34, 211, 238, 0.75))"
        : "drop-shadow(0 0 7px rgba(232, 121, 249, 0.75))",
      opacity: 1,
    };
  }

  if (pieceSkin === "glass") {
    return {
      fill: isWhite ? "rgba(255,255,255,0.62)" : "rgba(15,23,42,0.42)",
      stroke: isWhite ? "rgba(255,255,255,0.9)" : "rgba(15,23,42,0.78)",
      accent: isWhite ? "rgba(255,255,255,0.78)" : "rgba(30,41,59,0.58)",
      shadow: "drop-shadow(0 8px 10px rgba(15, 23, 42, 0.28))",
      opacity: 0.96,
    };
  }

  return {
    fill: isWhite ? "#f8fafc" : "#111827",
    stroke: isWhite ? "#334155" : "#f8fafc",
    accent: isWhite ? "#cbd5e1" : "#475569",
    shadow: "drop-shadow(0 2px 2px rgba(15, 23, 42, 0.35))",
    opacity: 1,
  };
}

function PieceSvg({
  code,
  skin,
  svgStyle,
}: {
  code: PieceCode;
  skin: Exclude<PieceSkinName, "default">;
  svgStyle?: CSSProperties;
}) {
  const isWhite = code.startsWith("w");
  const type = code.slice(1) as PieceType;
  const colors = getPieceColors(skin, isWhite);

  return (
    <div
      className="flex h-full w-full select-none items-center justify-center"
      style={{ ...svgStyle, width: "100%", height: "100%" }}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-[88%] w-[88%]"
        style={{
          filter: colors.shadow,
          opacity: colors.opacity,
        }}
        aria-hidden="true"
      >
        <PieceShape type={type} fill={colors.fill} stroke={colors.stroke} accent={colors.accent} />
      </svg>
    </div>
  );
}

function PieceShape({
  type,
  fill,
  stroke,
  accent,
}: {
  type: PieceType;
  fill: string;
  stroke: string;
  accent: string;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "K") {
    return (
      <>
        <path {...common} d="M30 82h40l-5-17H35z" />
        <path {...common} d="M38 65h24l7-34H31z" />
        <path {...common} d="M50 16v21" />
        <path {...common} d="M40 26h20" />
        <circle cx="50" cy="48" r="8" fill={accent} stroke={stroke} strokeWidth="3" />
      </>
    );
  }

  if (type === "Q") {
    return (
      <>
        <path {...common} d="M28 82h44l-5-16H33z" />
        <path {...common} d="M33 66h34l7-35-15 15-9-22-9 22-15-15z" />
        <circle cx="26" cy="28" r="5" fill={accent} stroke={stroke} strokeWidth="3" />
        <circle cx="50" cy="21" r="5" fill={accent} stroke={stroke} strokeWidth="3" />
        <circle cx="74" cy="28" r="5" fill={accent} stroke={stroke} strokeWidth="3" />
      </>
    );
  }

  if (type === "R") {
    return (
      <>
        <path {...common} d="M28 82h44l-5-18H33z" />
        <path {...common} d="M34 64h32V34H34z" />
        <path {...common} d="M30 34h40V20h-9v7h-8v-7h-8v7h-8v-7h-7z" />
        <path d="M40 44h20" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }

  if (type === "B") {
    return (
      <>
        <path {...common} d="M30 82h40l-5-16H35z" />
        <path {...common} d="M36 66h28c6-17-1-31-14-44-13 13-20 27-14 44z" />
        <path d="M50 29l-10 18" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="18" r="6" fill={accent} stroke={stroke} strokeWidth="3" />
      </>
    );
  }

  if (type === "N") {
    return (
      <>
        <path {...common} d="M28 82h45l-5-17H37z" />
        <path
          {...common}
          d="M38 65c-2-18 5-30 18-39l-3-9 17 8c7 8 8 21 1 31l-8 9z"
        />
        <path d="M58 36h1" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        <path d="M49 48c7 2 12 1 17-4" stroke={accent} strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    );
  }

  return (
    <>
      <path {...common} d="M32 82h36l-5-15H37z" />
      <path {...common} d="M38 67h24l-6-20H44z" />
      <circle cx="50" cy="33" r="13" fill={fill} stroke={stroke} strokeWidth="4" />
      <circle cx="50" cy="33" r="5" fill={accent} />
    </>
  );
}

function createCustomPieces(pieceSkin: Exclude<PieceSkinName, "default">) {
  const pieces: Partial<Record<PieceCode, (props?: { svgStyle?: CSSProperties }) => JSX.Element>> = {};

  for (const color of ["w", "b"] as const) {
    for (const type of pieceTypes) {
      const code = `${color}${type}` as PieceCode;
      pieces[code] = ({ svgStyle }: { svgStyle?: CSSProperties } = {}) => (
        <PieceSvg code={code} skin={pieceSkin} svgStyle={svgStyle} />
      );
    }
  }

  return pieces;
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