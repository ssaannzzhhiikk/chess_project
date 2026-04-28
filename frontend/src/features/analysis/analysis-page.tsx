"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { ApiError, ApiGame, clearAuthToken, getAuthToken, getGames, getProfile } from "@/lib/api";

type HistoryRow = {
  id: string;
  ply: number;
  move: string;
  quality: string;
  eval: string;
  explanation: string;
  bestMove: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mapGamesToRows(games: ApiGame[]): HistoryRow[] {
  return games.map((game, index) => ({
    id: game.id,
    ply: index + 1,
    move: game.opening || (game.mode === "ai" ? "AI match" : "Multiplayer match"),
    quality:
      game.result === "win" || game.result === "white"
        ? "Win"
        : game.result === "loss" || game.result === "black"
          ? "Loss"
          : "Draw",
    eval: `${game.moves.length} moves`,
    explanation:
      game.pgn.trim() || `Finished on ${formatDate(game.created_at)} in ${game.mode} mode.`,
    bestMove: game.moves.at(-1) || "No move recorded",
  }));
}

export function AnalysisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }

    let active = true;

    async function loadHistory() {
      try {
        await getProfile();
        const games = await getGames();
        const nextRows = mapGamesToRows(games);

        if (!active) {
          return;
        }

        setRows(nextRows);
        setSelectedId(nextRows[0]?.id ?? null);
      } catch (cause) {
        if (!active) {
          return;
        }

        if (cause instanceof ApiError && cause.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }

        setError("Unable to load match history right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [router]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );
  const summary = useMemo(() => {
    const wins = rows.filter((row) => row.quality === "Win").length;
    const losses = rows.filter((row) => row.quality === "Loss").length;
    const draws = rows.filter((row) => row.quality === "Draw").length;

    return {
      accuracy: rows.length ? Math.round((wins / rows.length) * 100) : 0,
      blunders: losses,
      mistakes: draws,
      bestMoves: wins,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Analysis"
        title="A coach-style breakdown, not just raw engine numbers."
        description="This page is structured so your backend analysis can plug in later without changing the UI contract."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Accuracy", value: `${summary.accuracy}%` },
            { label: "Blunders", value: `${summary.blunders}` },
            { label: "Mistakes", value: `${summary.mistakes}` },
            { label: "Best moves", value: `${summary.bestMoves}` },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardContent className="grid gap-6 lg:grid-cols-[52px_minmax(0,1fr)]">
            <div className="hidden justify-center lg:flex">
              <EvaluationBar value={selected?.quality === "Loss" ? -1 : 1} />
            </div>
            <div className="space-y-3">
              {loading ? (
                <>
                  <SkeletonCard lines={6} />
                  <SkeletonCard lines={6} />
                </>
              ) : rows.length ? (
                rows.map((row) => (
                  <button
                    key={row.id}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      selected?.id === row.id
                        ? "border-[var(--accent)] bg-white/7"
                        : "border-white/8 bg-white/4"
                    }`}
                    onClick={() => setSelectedId(row.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {row.ply}. {row.move}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{row.explanation}</p>
                      </div>
                      <div className="text-right">
                        <Badge>{row.quality}</Badge>
                        <p className="mt-2 text-sm text-[var(--muted)]">{row.eval}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="No saved games yet"
                  description="Finish a game and your backend match history will show up here."
                  label="History"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Badge>Selected position</Badge>
            {loading ? (
              <SkeletonCard lines={5} />
            ) : error ? (
              <EmptyState
                title="History unavailable"
                description={error}
                label="Backend"
              />
            ) : selected ? (
              <>
                <h3 className="text-2xl font-semibold">
                  {selected.quality}: {selected.move}
                </h3>
                <p className="text-sm leading-7 text-[var(--muted)]">{selected.explanation}</p>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Suggested best move
                  </p>
                  <p className="mt-2 text-lg font-semibold">{selected.bestMove}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button className="rounded-full border border-white/10 px-4 py-2 text-sm">
                    Previous
                  </button>
                  <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]">
                    Replay
                  </button>
                  <button className="rounded-full border border-white/10 px-4 py-2 text-sm">
                    Next
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                title="No analysis history yet"
                description="Your recent completed games will appear here once the backend has history to return."
                label="History"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {!loading && !rows.length ? (
        <Link href="/play">
          <Button>Start a game</Button>
        </Link>
      ) : null}
    </div>
  );
}
