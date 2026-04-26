import { Bot } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GameStatus({
  status,
  aiThinking,
  stockfishReady,
  stockfishError,
}: {
  status: string;
  aiThinking: boolean;
  stockfishReady: boolean;
  stockfishError: string | null;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Game status</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{status}</p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
          <Bot className={cn("h-4 w-4", aiThinking && "animate-spin")} />
          {aiThinking
            ? "Thinking"
            : stockfishReady
              ? "Engine ready"
              : stockfishError ?? "Loading"}
        </div>
      </CardContent>
    </Card>
  );
}

