import { Card, CardContent } from "@/components/ui/card";

export function MoveList({ moves }: { moves: string[] }) {
  const rows = Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    turn: index + 1,
    white: moves[index * 2] ?? null,
    black: moves[index * 2 + 1] ?? null,
  }));

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Move list</p>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            {moves.length} plies
          </p>
        </div>
        {moves.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Moves will appear as soon as the game starts.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              <span>Turn</span>
              <span>White</span>
              <span>Black</span>
            </div>
            <ol className="max-h-[340px] space-y-2 overflow-auto pr-1 text-sm">
              {rows.map((row) => (
                <li
                  key={`turn-${row.turn}`}
                  className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
                >
                  <span className="text-xs font-medium text-[var(--muted)]">{row.turn}.</span>
                  <span className="truncate font-medium">{row.white ?? "-"}</span>
                  <span className="truncate text-[var(--muted)]">{row.black ?? "-"}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
