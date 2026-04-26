import Link from "next/link";
import { Link2, RotateCcw, Swords, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameMode } from "@/features/game/types";

export function GameControls({
  gameMode,
  setGameMode,
  difficulty,
  setDifficulty,
  roomCode,
  setRoomCode,
  connectRoom,
  connectionState,
  inviteLink,
  onNewGame,
  onResign,
  onUndo,
}: {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  difficulty: number;
  setDifficulty: (value: number) => void;
  roomCode: string;
  setRoomCode: (value: string) => void;
  connectRoom: () => void;
  connectionState: string;
  inviteLink: string;
  onNewGame: () => void;
  onResign: () => void;
  onUndo: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {(["local", "ai", "online"] as const).map((mode) => (
            <button
              key={mode}
              className={`rounded-full px-4 py-2 text-sm transition ${
                gameMode === mode
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border border-white/10 bg-white/4 text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => setGameMode(mode)}
              type="button"
            >
              {mode === "local" ? "Local" : mode === "ai" ? "Play AI" : "Online"}
            </button>
          ))}
        </div>

        {gameMode === "ai" ? (
          <div>
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium">AI strength</p>
              <p className="text-[var(--muted)]">Depth {difficulty}</p>
            </div>
            <input
              className="mt-3 w-full accent-[var(--accent)]"
              max={14}
              min={6}
              onChange={(event) => setDifficulty(Number(event.target.value))}
              type="range"
              value={difficulty}
            />
          </div>
        ) : null}

        {gameMode === "online" ? (
          <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4 text-[var(--accent)]" />
              Real-time room
            </div>
            <input
              className="w-full rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
              onChange={(event) => setRoomCode(event.target.value)}
              value={roomCode}
            />
            <div className="flex gap-2">
              <Button onClick={connectRoom} size="sm">
                Connect
              </Button>
              <Button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                size="sm"
                variant="secondary"
              >
                Copy link
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">Status: {connectionState}</p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onNewGame} variant="primary">
            <RotateCcw className="h-4 w-4" />
            New Game
          </Button>
          <Button onClick={onUndo} variant="secondary">
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button onClick={onResign} variant="secondary">
            <Swords className="h-4 w-4" />
            Resign
          </Button>
          <Link href="/analysis">
            <Button className="w-full" variant="ghost">
              Analyze Game
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
