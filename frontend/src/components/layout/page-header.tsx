import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl space-y-3">
        {eyebrow ? <Badge>{eyebrow}</Badge> : null}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-base leading-7 text-[var(--muted)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
