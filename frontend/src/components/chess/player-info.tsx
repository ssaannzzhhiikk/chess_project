import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/lib/mock-data";

export function PlayerInfo({
  profile,
  role,
  subtitle,
}: {
  profile: Profile;
  role: "You" | "Stockfish" | "Guest";
  subtitle: string;
}) {
  return (
    <Card className="transition hover:-translate-y-0.5">
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{role === "You" ? profile.username : role}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <Badge>{role}</Badge>
          <p className="mt-2 text-lg font-semibold">{role === "You" ? profile.rating : 1600}</p>
        </div>
      </CardContent>
    </Card>
  );
}

