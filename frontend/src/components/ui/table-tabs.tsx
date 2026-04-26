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
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`rounded-full px-4 py-2 text-sm transition ${
            active === tab
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "text-[var(--muted)]"
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

