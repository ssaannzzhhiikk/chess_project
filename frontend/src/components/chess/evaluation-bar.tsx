import { cn } from "@/lib/utils";

export function EvaluationBar({ value }: { value: number }) {
  const normalized = Math.max(5, Math.min(95, 50 + value * 5));

  return (
    <div className="flex h-72 w-6 overflow-hidden rounded-full border border-white/10 bg-black/30">
      <div
        className={cn("mt-auto w-full bg-[linear-gradient(180deg,#f6f0df,#b4ffcf)] transition-all duration-300")}
        style={{ height: `${normalized}%` }}
      />
    </div>
  );
}

