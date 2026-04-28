import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  boardThemeOptions,
  pieceSkinOptions,
  type BoardThemeName,
  type PieceSkinName,
} from "@/features/game/board-appearance";
import { cn } from "@/lib/utils";

export function BoardAppearancePanel({
  boardTheme,
  pieceSkin,
  isPro,
  onBoardThemeChange,
  onPieceSkinChange,
}: {
  boardTheme: BoardThemeName;
  pieceSkin: PieceSkinName;
  isPro: boolean;
  onBoardThemeChange: (theme: BoardThemeName) => void;
  onPieceSkinChange: (skin: PieceSkinName) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Board style</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Switch themes and piece skins without changing gameplay.
            </p>
          </div>
          <Badge>{isPro ? "Pro ready" : "Starter"}</Badge>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Board theme</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {boardThemeOptions.map((option) => (
              <button
                key={option.id}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-sm font-medium transition",
                  boardTheme === option.id
                    ? "border-[var(--accent)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                    : "border-white/8 bg-white/4 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
                )}
                onClick={() => onBoardThemeChange(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Piece skin</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pieceSkinOptions.map((option) => {
              const locked = option.pro && !isPro;

              return (
                <button
                  key={option.id}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition",
                    pieceSkin === option.id
                      ? "border-[var(--accent)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                      : "border-white/8 bg-white/4 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
                  )}
                  onClick={() => onPieceSkinChange(option.id)}
                  type="button"
                >
                  <span>{option.label}</span>
                  {locked ? (
                    <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                      <Lock className="h-3.5 w-3.5" />
                      Pro
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
