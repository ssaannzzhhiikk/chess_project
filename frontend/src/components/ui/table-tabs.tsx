export function TableTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`rounded-full px-4 py-2 text-sm transition ${
            active === tab
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
          onClick={() => onChange(tab)}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
