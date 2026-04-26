import { Card, CardContent } from "@/components/ui/card";

export function ProfileStats({
  items,
}: {
  items: Array<{ label: string; value: string; helper?: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
            {item.helper ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{item.helper}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

