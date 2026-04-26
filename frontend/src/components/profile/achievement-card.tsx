import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Achievement } from "@/lib/mock-data";

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  return (
    <Card className="transition hover:-translate-y-0.5">
      <CardContent>
        <Badge>Unlocked</Badge>
        <h3 className="mt-4 text-lg font-semibold">{achievement.name}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          {achievement.description}
        </p>
      </CardContent>
    </Card>
  );
}
