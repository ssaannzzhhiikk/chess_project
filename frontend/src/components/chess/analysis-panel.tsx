import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Profile } from "@/lib/mock-data";
import type { StoredGame } from "@/features/game/types";

export function AnalysisPanel({
  profile,
  selectedReplay,
  analysisBusy,
  onExplain,
}: {
  profile: Profile;
  selectedReplay: StoredGame | null;
  analysisBusy: boolean;
  onExplain: () => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Badge>AI Coach</Badge>
        <h3 className="mt-4 text-xl font-semibold">Review mistakes like a training product</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedReplay ? (
          <p className="text-sm text-[var(--muted)]">
            Finish a game to unlock move-quality review and human-language coaching.
          </p>
        ) : (
          <>
            {selectedReplay.insights.length === 0 ? (
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-[var(--muted)]">
                {!profile.isPro
                  ? "Upgrade to Pro to unlock backend AI review and stored coach insights."
                  : analysisBusy
                    ? "Running post-game analysis..."
                    : "No major mistakes were stored for this game."}
              </div>
            ) : (
              selectedReplay.insights.slice(0, 3).map((insight) => (
                <div
                  key={`${insight.ply}-${insight.san}`}
                  className="rounded-[24px] border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Move {insight.ply}: {insight.san}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Best move {insight.bestMove} | swing {insight.delta} cp
                      </p>
                    </div>
                    <Badge>{insight.severity}</Badge>
                  </div>
                  {insight.explanation ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      {insight.explanation}
                    </p>
                  ) : null}
                </div>
              ))
            )}
            <Button
              onClick={onExplain}
              variant={profile.isPro ? "primary" : "secondary"}
            >
              <Sparkles className="h-4 w-4" />
              {profile.isPro
                ? "Explain top mistake"
                : "Advanced coach explanations are Pro"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
