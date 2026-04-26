import Link from "next/link";
import { Bot, Crown, Trophy, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { landingFeatures } from "@/lib/mock-data";

const icons = [Bot, Users, Crown, Trophy];

export function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.18)] lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div className="space-y-5">
          <Badge>AI-powered chess training platform</Badge>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
            A modern chess SaaS for players who want better games and better feedback.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[var(--muted)]">
            Endgame blends fast play, Stockfish strength, AI explanations, product-grade replay, and progression systems into one polished experience.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/play">
              <Button size="lg">Play Now</Button>
            </Link>
            <Link href="/analysis">
              <Button size="lg" variant="secondary">
                Train with AI
              </Button>
            </Link>
          </div>
        </div>
        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <CardContent className="space-y-4">
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Product preview</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-sm font-semibold">Play surface</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Responsive board, move sounds, last-move highlights, and polished controls.</p>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-sm font-semibold">AI coach</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Best moves, blunders, and natural-language explanation flow.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <PageHeader
        eyebrow="Features"
        title="Built around the full training loop."
        description="Play, review, improve, and compete without bouncing between disconnected tools."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {landingFeatures.map((feature, index) => {
          const Icon = icons[index];
          return (
            <Card key={feature.title} className="transition hover:-translate-y-1">
              <CardContent>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-[var(--accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          "Play a live or AI match from a responsive board.",
          "Review mistakes, best moves, and engine swings.",
          "Level up with XP, achievements, and city leaderboard status.",
        ].map((step, index) => (
          <Card key={step}>
            <CardContent>
              <Badge>Step {index + 1}</Badge>
              <p className="mt-4 text-lg font-semibold">{step}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <Badge>Upgrade to Pro</Badge>
            <h3 className="mt-4 text-3xl font-semibold">
              Unlock deeper AI narratives, richer analysis, and premium training tools.
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Advanced explanations, longer review history, and premium coaching are positioned as the monetization layer from day one.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/8 bg-white/4 p-6 text-center">
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Starter Pro</p>
            <p className="mt-3 text-4xl font-semibold">$9</p>
            <p className="mt-2 text-sm text-[var(--muted)]">per month</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
