"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MoonStar, Play, Sparkles, SunMedium, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { navLinks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[color:rgba(10,10,14,0.65)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),#f7cf73)] text-[var(--accent-foreground)] shadow-[0_12px_30px_rgba(241,161,95,0.25)]">
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
                "rounded-full px-4 py-2 text-sm transition",
                pathname === link.href
                  ? "bg-white/10 text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-white/6 hover:text-[var(--foreground)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={toggleTheme}
            type="button"
          >
            {theme === "dark" ? (
              <SunMedium className="h-4 w-4" />
            ) : (
              <MoonStar className="h-4 w-4" />
            )}
          </button>
          <Link href="/play">
            <Button size="sm">
              <Play className="h-4 w-4" />
              Play
            </Button>
          </Link>
          <Link href="/login">
            <Button size="sm" variant="secondary">
              Login
            </Button>
          </Link>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 md:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/8 px-4 py-4 md:hidden">
          <div className="space-y-2">
            <Badge>Navigation</Badge>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-2xl px-4 py-3 text-sm text-[var(--muted)] transition hover:bg-white/6 hover:text-[var(--foreground)]"
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
              <Link href="/play" className="flex-1" onClick={() => setOpen(false)}>
                <Button className="w-full" size="sm">
                  Play
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

