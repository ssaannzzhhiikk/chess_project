"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, login, setAuthSession } from "@/lib/api";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await login(email, password);
      setAuthSession(response);
      router.push("/profile");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Unable to sign in right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

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
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <input
                  className="w-full rounded-[20px] border border-white/10 bg-white/4 px-4 py-3 outline-none"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  value={email}
                />
                <input
                  className="w-full rounded-[20px] border border-white/10 bg-white/4 px-4 py-3 outline-none"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  value={password}
                />
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? "Signing in..." : "Login"}
              </Button>
            </form>
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
