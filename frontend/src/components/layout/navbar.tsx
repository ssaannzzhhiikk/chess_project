"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, MoonStar, Play, Sparkles, SunMedium, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearAuthSession, getAuthToken } from "@/lib/api";
import { navLinks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    queueMicrotask(() => {
      setAuthenticated(Boolean(getAuthToken()));
    });
  }, [pathname]);

  function handleLogout() {
    clearAuthSession();
    setAuthenticated(false);
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Endgame</p>
            <p className="text-xs text-[var(--muted)]">AI chess training</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--border-strong)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={toggleTheme}
            type="button"
          >
            {theme === "dark" ? (
              <SunMedium className="h-4 w-4" />
            ) : (
              <MoonStar className="h-4 w-4" />
            )}
          </button>
          <Link href="/game">
            <Button size="sm">
              <Play className="h-4 w-4" />
              Play
            </Button>
          </Link>
          {authenticated ? (
            <Button onClick={handleLogout} size="sm" variant="secondary">
              Logout
            </Button>
          ) : (
            <>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Login
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] md:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 md:hidden">
          <div className="space-y-2">
            <Badge>Navigation</Badge>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block rounded-xl px-4 py-3 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-[var(--surface)] font-medium text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={toggleTheme}
                size="sm"
                variant="secondary"
              >
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </Button>
              <Link href="/game" className="flex-1" onClick={() => setOpen(false)}>
                <Button className="w-full" size="sm">
                  Play
                </Button>
              </Link>
            </div>
            {authenticated ? (
              <Button className="w-full" onClick={handleLogout} size="sm" variant="secondary">
                Logout
              </Button>
            ) : (
              <div className="space-y-2">
                <Link href="/register" onClick={() => setOpen(false)}>
                  <Button className="w-full" size="sm">
                    Register
                  </Button>
                </Link>
                <Link href="/login" onClick={() => setOpen(false)}>
                  <Button className="w-full" size="sm" variant="secondary">
                    Login
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

