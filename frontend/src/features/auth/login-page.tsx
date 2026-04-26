import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoginPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Authentication"
        title="Sign in to keep your rating, history, and AI coaching in sync."
        description="This screen is ready to connect to JWT or Supabase auth later. For now, it provides a polished product shell."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-2xl font-semibold">Welcome back</p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Sign in to continue your chess training loop and unlock synced replays, progress, and Pro analysis.
            </p>
            <div className="space-y-3">
              <input
                className="w-full rounded-[20px] border border-white/10 bg-white/4 px-4 py-3 outline-none"
                placeholder="Email"
                type="email"
              />
              <input
                className="w-full rounded-[20px] border border-white/10 bg-white/4 px-4 py-3 outline-none"
                placeholder="Password"
                type="password"
              />
            </div>
            <Button className="w-full">Login</Button>
            <Button className="w-full" variant="secondary">
              Continue with Google
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
                Why players upgrade
              </p>
              <h3 className="mt-4 text-3xl font-semibold">
                Deeper AI coaching, cleaner replay tools, and a profile worth returning to.
              </h3>
            </div>
            <Link href="/play" className="mt-6">
              <Button variant="secondary">Continue as guest</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

