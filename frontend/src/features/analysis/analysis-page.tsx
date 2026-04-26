"use client";

import { useState } from "react";

import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useMockLoading } from "@/hooks/use-mock-loading";
import { analysisRows, analysisSummary } from "@/lib/mock-data";

export function AnalysisPage() {
  const loading = useMockLoading();
  const [selected, setSelected] = useState(analysisRows[0]);

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
            { label: "Accuracy", value: `${analysisSummary.accuracy}%` },
            { label: "Blunders", value: `${analysisSummary.blunders}` },
            { label: "Mistakes", value: `${analysisSummary.mistakes}` },
            { label: "Best moves", value: `${analysisSummary.bestMoves}` },
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
              <EvaluationBar value={selected.eval.startsWith("-") ? -1 : 1} />
            </div>
            <div className="space-y-3">
              {loading ? (
                <>
                  <SkeletonCard lines={6} />
                  <SkeletonCard lines={6} />
                </>
              ) : (
                analysisRows.map((row) => (
                  <button
                    key={`${row.ply}-${row.move}`}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      selected.ply === row.ply
                        ? "border-[var(--accent)] bg-white/7"
                        : "border-white/8 bg-white/4"
                    }`}
                    onClick={() => setSelected(row)}
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
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Badge>Selected position</Badge>
            {loading ? (
              <SkeletonCard lines={5} />
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

