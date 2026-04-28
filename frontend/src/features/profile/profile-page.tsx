"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { AchievementCard } from "@/components/profile/achievement-card";
import { ProfileStats } from "@/components/profile/profile-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { ApiError, ApiGame, ApiUser, clearAuthToken, getAuthToken, getGames, getProfile, upgradeToPro } from "@/lib/api";
import { achievements, Profile } from "@/lib/mock-data";

function toTitleCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapGamesToProfile(user: ApiUser, games: ApiGame[]): Profile {
  const wins = games.filter((game) => game.result === "win" || game.result === "white").length;
  const losses = games.filter((game) => game.result === "loss" || game.result === "black").length;
  const draws = games.filter((game) => game.result === "draw").length;
  const xp = wins * 60 + losses * 40 + draws * 50;
  const level = Math.max(1, Math.floor(xp / 120) + 1);
  const rating = Math.max(800, 1200 + wins * 14 - losses * 8 + draws * 2);

  return {
    username: toTitleCase(user.email.split("@")[0] || "Player"),
    city: games[0]?.city ?? "Unknown",
    rating,
    xp,
    level,
    wins,
    losses,
    draws,
    streak: wins,
    isPro: user.is_pro,
    email: user.email,
    achievements: [],
  };
}

function formatGameDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mapRecentGames(games: ApiGame[]) {
  return games.slice(0, 5).map((game) => ({
    id: game.id,
    opponent: game.mode === "ai" ? "AI" : "Online opponent",
    result:
      game.result === "win" || game.result === "white"
        ? "Win"
        : game.result === "loss" || game.result === "black"
          ? "Loss"
          : "Draw",
    opening: game.opening || "Unclassified opening",
    date: formatGameDate(game.created_at),
    ratingDelta:
      game.result === "win" || game.result === "white"
        ? "+14"
        : game.result === "loss" || game.result === "black"
          ? "-8"
          : "+2",
  }));
}

export function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }

    let active = true;

    async function loadProfile() {
      try {
        const user = await getProfile();
        const history = await getGames();

        if (!active) {
          return;
        }

        setGames(history);
        setProfile(mapGamesToProfile(user, history));
      } catch (cause) {
        if (!active) {
          return;
        }

        if (cause instanceof ApiError && cause.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }

        setError("Unable to load your profile right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const totalGames = useMemo(() => {
    if (!profile) {
      return 0;
    }

    return profile.wins + profile.losses + profile.draws;
  }, [profile]);
  const winRate = profile ? Math.round((profile.wins / Math.max(1, totalGames)) * 100) : 0;
  const recentGames = mapRecentGames(games);

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeOpen}
        busy={upgradeBusy}
        error={upgradeError}
        onClose={() => {
          setUpgradeOpen(false);
          setUpgradeError(null);
        }}
        onUpgrade={async () => {
          setUpgradeBusy(true);
          setUpgradeError(null);
          try {
            const response = await upgradeToPro();
            setProfile((current) =>
              current
                ? {
                    ...current,
                    isPro: response.user.is_pro,
                    email: response.user.email,
                  }
                : current,
            );
            setUpgradeOpen(false);
          } catch (cause) {
            if (cause instanceof ApiError) {
              setUpgradeError(cause.message);
            } else {
              setUpgradeError("Unable to upgrade right now.");
            }
          } finally {
            setUpgradeBusy(false);
          }
        }}
      />

      <PageHeader
        eyebrow="Profile"
        title={`${profile?.username ?? "Player"}'s performance hub`}
        description="A polished profile view for progress, ratings, streaks, recent games, and achievements."
      />

      {loading ? (
        <SkeletonCard lines={6} />
      ) : error || !profile ? (
        <EmptyState
          title="Profile unavailable"
          description={error ?? "Sign in again to load your account from the backend."}
          label="Auth required"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,var(--accent),#6c8dff)] text-2xl font-semibold text-white">
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge>{profile.city}</Badge>
                  <Badge>{profile.isPro ? "Pro" : "Starter"}</Badge>
                </div>
                <h2 className="mt-3 text-3xl font-semibold">{profile.username}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{profile.email}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Rating</p>
                <p className="mt-2 text-2xl font-semibold">{profile.rating}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">XP</p>
                <p className="mt-2 text-2xl font-semibold">{profile.xp}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Streak</p>
                <p className="mt-2 text-2xl font-semibold">{profile.streak}</p>
              </div>
              <div className="flex items-center">
                <Button
                  onClick={() => setUpgradeOpen(true)}
                  variant={profile.isPro ? "secondary" : "primary"}
                  className="w-full"
                  disabled={profile.isPro}
                >
                  {profile.isPro ? "Pro active" : "Upgrade to Pro"}
                </Button>
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
            { label: "Wins", value: `${profile?.wins ?? 0}` },
            { label: "Losses", value: `${profile?.losses ?? 0}` },
            { label: "Win rate", value: `${winRate}%` },
            { label: "Current streak", value: `${profile?.streak ?? 0}`, helper: "Wins in a row" },
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
            ) : recentGames.length ? (
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
            ) : (
              <EmptyState
                title="No games yet"
                description="Once your backend history starts filling up, recent matches will appear here."
                label="History"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">XP progress</p>
            <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Level {profile?.level ?? 1}</span>
                <span>{(profile?.xp ?? 0) % 120}/120 XP</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#6c8dff)]"
                  style={{ width: `${(((profile?.xp ?? 0) % 120) / 120) * 100}%` }}
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
          : profile?.achievements.length
            ? profile.achievements.map((achievementId) => (
                <AchievementCard
                  key={achievementId}
                  achievement={achievements[achievementId]}
                />
              ))
            : (
                <div className="md:col-span-2 xl:col-span-4">
                  <EmptyState
                    title="No achievements yet"
                    description="Your account is connected. Achievements will appear here once the backend starts returning them."
                    label="Progress"
                  />
                </div>
              )}
      </div>
    </div>
  );
}
