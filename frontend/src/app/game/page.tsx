import { AppLayout } from "@/components/layout/app-layout";
import { GameBoardPage } from "@/features/game/game-board-page";

export default function GamePage() {
  return (
    <AppLayout>
      <GameBoardPage />
    </AppLayout>
  );
}
