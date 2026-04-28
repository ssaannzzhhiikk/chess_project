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
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import {
  ApiError,
  ApiGame,
  ApiGameAnalysis,
  clearAuthSession,
  getAuthToken,
  getGameAnalysis,
  getGames,
  getProfile,
  upgradeToPro,
} from "@/lib/api";

type HistoryRow = {
  id: string;
  ply: number;
  move: string;
  quality: string;
  eval: string;
  explanation: string;
  bestMove: string;
  analysis: ApiGameAnalysis | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mapGamesToRows(games: ApiGame[], analyses: Array<ApiGameAnalysis | null>): HistoryRow[] {
  return games.map((game, index) => {
    const analysis = analyses[index] ?? null;
    const quality =
      analysis?.blunders_count
        ? "Needs review"
        : analysis?.mistakes_count
          ? "Mistakes"
          : game.result === "win" || game.result === "white"
            ? "Win"
            : game.result === "loss" || game.result === "black"
              ? "Loss"
              : "Draw";

    return {
    id: game.id,
    ply: index + 1,
    move: game.opening || (game.mode === "ai" ? "AI match" : "Multiplayer match"),
    quality,
    eval: analysis
      ? `${analysis.blunders_count} blunders, ${analysis.mistakes_count} mistakes`
      : `${game.moves.length} moves`,
    explanation:
      analysis?.summary ||
      game.pgn.trim() ||
      `Finished on ${formatDate(game.created_at)} in ${game.mode} mode.`,
    bestMove: analysis?.best_moves[0] || game.moves.at(-1) || "No move recorded",
    analysis,
  };
  });
}

export function AnalysisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }

    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const user = await getProfile();
        const games = await getGames();
        const nextIsPro = user.is_pro;
        const analyses = nextIsPro
          ? await Promise.all(
              games.map(async (game) => {
                try {
                  return await getGameAnalysis(game.id);
                } catch (cause) {
                  if (cause instanceof ApiError && cause.status === 404) {
                    return null;
                  }
                  throw cause;
                }
              }),
            )
          : games.map(() => null);
        const nextRows = mapGamesToRows(games, analyses);

        if (!active) {
          return;
        }

        setIsPro(nextIsPro);
        setRows(nextRows);
        setSelectedId(nextRows[0]?.id ?? null);
      } catch (cause) {
        if (!active) {
          return;
        }

        if (cause instanceof ApiError && cause.status === 401) {
          clearAuthSession();
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
  }, [refreshKey, router]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );
  const summary = useMemo(() => {
    if (!isPro) {
      return {
        accuracy: 0,
        blunders: 0,
        mistakes: 0,
        bestMoves: 0,
      };
    }

    const blunders = rows.reduce((total, row) => total + (row.analysis?.blunders_count ?? 0), 0);
    const mistakes = rows.reduce((total, row) => total + (row.analysis?.mistakes_count ?? 0), 0);
    const bestMoves = rows.reduce((total, row) => total + (row.analysis?.best_moves.length ?? 0), 0);
    const penalty = blunders * 12 + mistakes * 5;

    return {
      accuracy: rows.length ? Math.max(0, 100 - penalty) : 0,
      blunders,
      mistakes,
      bestMoves,
    };
  }, [isPro, rows]);

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
            setIsPro(response.user.is_pro);
            setUpgradeOpen(false);
            setRefreshKey((current) => current + 1);
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

      {!loading && !isPro ? (
        <Card>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge>Pro required</Badge>
              <h3 className="mt-3 text-2xl font-semibold">Advanced AI Coach is locked on this account.</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Upgrade to unlock saved analysis, best-move suggestions, and backend coach review.
              </p>
            </div>
            <Button onClick={() => setUpgradeOpen(true)}>Upgrade to Pro</Button>
          </CardContent>
        </Card>
      ) : null}

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
            ) : !isPro ? (
              <EmptyState
                title="AI Coach is a Pro feature"
                description="Upgrade this account to load persisted backend analysis for your saved games."
                label="Upgrade"
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
