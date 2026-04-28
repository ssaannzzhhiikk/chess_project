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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />
      <Container className="py-6 md:py-8">{children}</Container>
      {footer ? (
        <footer className="border-t border-[var(--border)] py-6">
          <Container className="flex flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>Endgame is built for players who want clear feedback, fast games, and a polished training loop.</p>
            <p>AI Coach advanced narratives are part of Pro.</p>
          </Container>
        </footer>
      ) : null}
    </div>
  );
}
