import { Badge } from "@/components/ui/badge";

export function EmptyState({
  title,
  description,
  label = "Nothing here yet",
}: {
  title: string;
  description: string;
  label?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
      <Badge>{label}</Badge>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </div>
  );
}
