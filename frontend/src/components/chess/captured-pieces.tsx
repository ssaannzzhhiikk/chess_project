import { Card, CardContent } from "@/components/ui/card";
import { formatPiece } from "@/features/game/chess-helpers";

function PieceStack({ pieces }: { pieces: string[] }) {
  if (pieces.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No captures yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pieces.map((piece, index) => (
        <span
          key={`${piece}-${index}`}
          className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
        >
          {formatPiece(piece)}
        </span>
      ))}
    </div>
  );
}

export function CapturedPieces({
  whiteCaptured,
  blackCaptured,
  score,
}: {
  whiteCaptured: string[];
  blackCaptured: string[];
  score: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Captured pieces</p>
          <p className="text-sm text-[var(--muted)]">
            Material {score > 0 ? `+${score}` : score}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            You captured
          </p>
          <PieceStack pieces={whiteCaptured} />
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            Opponent captured
          </p>
          <PieceStack pieces={blackCaptured} />
        </div>
      </CardContent>
    </Card>
  );
}

