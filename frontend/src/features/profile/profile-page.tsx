"use client";

import { AchievementCard } from "@/components/profile/achievement-card";
import { ProfileStats } from "@/components/profile/profile-stats";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useMockLoading } from "@/hooks/use-mock-loading";
import { achievements, defaultProfile, recentGames } from "@/lib/mock-data";

export function ProfilePage() {
  const loading = useMockLoading();
  const totalGames =
    defaultProfile.wins + defaultProfile.losses + defaultProfile.draws;
  const winRate = Math.round((defaultProfile.wins / Math.max(1, totalGames)) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title={`${defaultProfile.username}'s performance hub`}
        description="A polished profile view for progress, ratings, streaks, recent games, and achievements."
      />

      {loading ? (
        <SkeletonCard lines={6} />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,var(--accent),#6c8dff)] text-2xl font-semibold text-white">
                {defaultProfile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <Badge>{defaultProfile.city}</Badge>
                <h2 className="mt-3 text-3xl font-semibold">{defaultProfile.username}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{defaultProfile.email}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Rating</p>
                <p className="mt-2 text-2xl font-semibold">{defaultProfile.rating}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">XP</p>
                <p className="mt-2 text-2xl font-semibold">{defaultProfile.xp}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Streak</p>
                <p className="mt-2 text-2xl font-semibold">{defaultProfile.streak}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <ProfileStats
          items={[
            { label: "Games played", value: `${totalGames}` },
            { label: "Wins", value: `${defaultProfile.wins}` },
            { label: "Losses", value: `${defaultProfile.losses}` },
            { label: "Win rate", value: `${winRate}%` },
            { label: "Current streak", value: `${defaultProfile.streak}`, helper: "Wins in a row" },
          ]}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">Recent games</p>
            {loading ? (
              <>
                <SkeletonCard lines={4} />
                <SkeletonCard lines={4} />
              </>
            ) : (
              recentGames.map((game) => (
                <div key={game.id} className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {game.result} vs {game.opponent}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {game.opening} | {game.date}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-300">{game.ratingDelta}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">XP progress</p>
            <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Level {defaultProfile.level}</span>
                <span>{defaultProfile.xp % 120}/120 XP</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#6c8dff)]"
                  style={{ width: `${((defaultProfile.xp % 120) / 120) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))
          : defaultProfile.achievements.map((achievementId) => (
              <AchievementCard
                key={achievementId}
                achievement={achievements[achievementId]}
              />
            ))}
      </div>
    </div>
  );
}

