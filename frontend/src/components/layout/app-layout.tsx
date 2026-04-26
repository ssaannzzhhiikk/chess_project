import { Container } from "@/components/layout/container";
import { Navbar } from "@/components/layout/navbar";

export function AppLayout({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(241,161,95,0.14),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(72,116,255,0.12),_transparent_20%),linear-gradient(180deg,var(--background),var(--background-soft))] text-[var(--foreground)]">
      <Navbar />
      <Container className="py-8">{children}</Container>
      {footer ? (
        <footer className="border-t border-white/8 py-8">
          <Container className="flex flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>Endgame is built for players who want clear feedback, fast games, and a polished training loop.</p>
            <p>AI Coach advanced narratives are part of Pro.</p>
          </Container>
        </footer>
      ) : null}
    </div>
  );
}
