"use client";

import { useMemo, useState } from "react";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { TableTabs } from "@/components/ui/table-tabs";
import { useMockLoading } from "@/hooks/use-mock-loading";
import { defaultProfile, leaderboardSeed } from "@/lib/mock-data";

export function LeaderboardPage() {
  const loading = useMockLoading();
  const [tab, setTab] = useState("Global");

  const entries = useMemo(() => {
    const combined = [
      ...leaderboardSeed,
      {
        username: defaultProfile.username,
        city: defaultProfile.city,
        rating: defaultProfile.rating,
        xp: defaultProfile.xp,
        wins: defaultProfile.wins,
        losses: defaultProfile.losses,
        level: defaultProfile.level,
      },
    ];

    const filtered =
      tab === "Friends"
        ? combined.filter((entry) => ["Mira", "Lina", "Noor"].includes(entry.username))
        : combined;

    return filtered
      .sort((left, right) => right.rating - left.rating)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        winRate: Math.round((entry.wins / Math.max(1, entry.wins + entry.losses)) * 100),
      }));
  }, [tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leaderboard"
        title="Compete globally, locally, or inside your own circle."
        description="This ranking UI is ready for a real backend, but it already has the polish and filtering behavior of a production product."
        actions={<TableTabs active={tab} onChange={setTab} tabs={["Global", "Friends"]} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <SkeletonCard lines={6} />
            <SkeletonCard lines={6} />
          </>
        ) : (
          <>
            <div className="rounded-[28px] border border-white/10 bg-white/4 p-5">
              <p className="text-sm font-semibold">Global leaderboard</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Rating-first ranking across all active players.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/4 p-5">
              <p className="text-sm font-semibold">City leaderboard</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Highlight the local competition and drive city identity.
              </p>
            </div>
          </>
        )}
      </div>

      {loading ? <SkeletonCard lines={8} /> : <LeaderboardTable entries={entries} />}
    </div>
  );
}

