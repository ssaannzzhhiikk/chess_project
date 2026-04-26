import { Card, CardContent } from "@/components/ui/card";

export function MoveList({ moves }: { moves: string[] }) {
  return (
    <Card className="h-full">
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Move list</p>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            {moves.length} plies
          </p>
        </div>
        {moves.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Moves will appear as soon as the game starts.</p>
        ) : (
          <ol className="grid max-h-[340px] grid-cols-2 gap-2 overflow-auto pr-1 text-sm">
            {moves.map((move, index) => (
              <li
                key={`${move}-${index}`}
                className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
              >
                {index + 1}. {move}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

