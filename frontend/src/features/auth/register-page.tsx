"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, register, setAuthSession } from "@/lib/api";

export function RegisterPage() {
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
      const response = await register(email, password);
      setAuthSession(response);
      router.push("/profile");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Unable to create an account right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Authentication"
        title="Create an account to save your progress, games, and coaching."
        description="Register with your email to unlock synced history, profile tracking, and multiplayer access."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-2xl font-semibold">Create account</p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Start with a simple email and password, then continue into your profile and saved match history.
            </p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  value={email}
                />
                <input
                  className="w-full rounded-xl px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  value={password}
                />
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? "Creating account..." : "Register"}
              </Button>
            </form>
            <p className="text-sm text-[var(--muted)]">
              Already have an account?{" "}
              <Link className="text-[var(--foreground)] underline underline-offset-4" href="/login">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
                What you unlock
              </p>
              <h3 className="mt-4 text-3xl font-semibold">
                Persistent game history, profile progress, Pro upgrade flow, and online rooms tied to your account.
              </h3>
            </div>
            <Link href="/login" className="mt-6">
              <Button variant="secondary">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
