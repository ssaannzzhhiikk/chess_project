import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary:
    "border border-transparent bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface)]",
  ghost: "border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
};

const sizes = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
