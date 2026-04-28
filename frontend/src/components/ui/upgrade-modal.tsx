"use client";

import { Crown, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UpgradeModal({
  open,
  busy,
  error,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(7,10,18,0.74)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Upgrade to Pro</p>
            <h3 className="mt-3 text-2xl font-semibold">Unlock advanced AI Coach</h3>
          </div>
          <button
            className="rounded-full border border-white/10 p-2 text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-[rgba(241,161,95,0.22)] bg-[rgba(241,161,95,0.08)] p-4 text-sm text-[var(--muted)]">
          Pro gives you backend AI analysis, saved coach breakdowns, and move-by-move explanations.
        </div>

        <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
          <p>Advanced game analysis and stored review history</p>
          <p>Coach-written explanations for your biggest mistakes</p>
          <p>One-click mock upgrade in this environment</p>
        </div>

        {error ? (
          <p className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button onClick={onUpgrade} disabled={busy} className="flex-1">
            <Crown className="h-4 w-4" />
            {busy ? "Upgrading..." : "Upgrade now"}
          </Button>
          <Button onClick={onClose} disabled={busy} variant="secondary" className="flex-1">
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
