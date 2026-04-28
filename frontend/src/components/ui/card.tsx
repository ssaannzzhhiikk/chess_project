import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-0", className)}>{children}</div>;
}

export function CardContent({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
