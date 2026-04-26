import { Card, CardContent } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/lib/mock-data";

export function LeaderboardTable({
  entries,
}: {
  entries: Array<
    LeaderboardEntry & {
      rank: number;
      winRate: number;
    }
  >;
}) {
  return (
    <Card>
      <CardContent className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-white/8 bg-white/4 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              <tr>
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Player</th>
                <th className="px-5 py-4">Rating</th>
                <th className="px-5 py-4">Wins</th>
                <th className="px-5 py-4">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.username} className="border-b border-white/6 last:border-b-0">
                  <td className="px-5 py-4 font-semibold">{entry.rank}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-sm font-semibold">
                        {entry.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{entry.username}</p>
                        <p className="text-sm text-[var(--muted)]">{entry.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{entry.rating}</td>
                  <td className="px-5 py-4">{entry.wins}</td>
                  <td className="px-5 py-4">{entry.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

