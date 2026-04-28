"use client";

import Link from "next/link";
import { Crown, FlipHorizontal2 } from "lucide-react";

import { AnalysisPanel } from "@/components/chess/analysis-panel";
import { CapturedPieces } from "@/components/chess/captured-pieces";
import { ChessBoard } from "@/components/chess/chess-board";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { GameControls } from "@/components/chess/game-controls";
import { GameStatus } from "@/components/chess/game-status";
import { LoadingBoard } from "@/components/chess/loading-board";
import { MoveList } from "@/components/chess/move-list";
import { PlayerInfo } from "@/components/chess/player-info";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { useChessGame } from "./use-chess-game";

export function PlayPage() {
  const game = useChessGame();

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={game.upgradeModalOpen}
        busy={game.upgradeBusy}
        error={game.upgradeError}
        onClose={game.closeUpgradeModal}
        onUpgrade={game.handleUpgrade}
      />

      <PageHeader
        eyebrow="Play"
        title="Train, duel, and review from one polished board."
        description="The play surface is built to feel like a product: clear controls, responsive board behavior, move feedback, and replay-ready history."
        actions={
          <>
            <Button
              onClick={() =>
                game.setOrientation(
                  game.orientation === "white" ? "black" : "white",
                )
              }
              variant="secondary"
            >
              <FlipHorizontal2 className="h-4 w-4" />
              Flip board
            </Button>
            <Link href="/analysis">
              <Button variant="secondary">
                <Crown className="h-4 w-4" />
                Open analysis
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_390px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerInfo profile={game.profile} role="You" subtitle={`${game.profile.city} | level ${game.profile.level}`} />
            <PlayerInfo
              profile={game.profile}
              role={game.gameMode === "ai" ? "Stockfish" : "Guest"}
              subtitle={
                game.gameMode === "ai"
                  ? `Depth ${game.difficulty}`
                  : game.gameMode === "online"
                    ? "Connected room player"
                    : "Local challenger"
              }
            />
          </div>

          <GameStatus
            aiThinking={game.aiThinking}
            status={game.status}
            stockfishError={game.stockfishError}
            stockfishReady={game.stockfishReady}
          />

          <div className="grid gap-4 lg:grid-cols-[48px_minmax(0,1fr)]">
            <div className="hidden justify-center lg:flex">
              <EvaluationBar
                value={game.selectedReplay?.insights[0]?.evaluation ?? 0}
              />
            </div>
            {game.hydrated ? (
              <ChessBoard
                allowDragging={
                  !game.aiThinking &&
                  !(game.gameMode === "online" && game.connectionState !== "connected")
                }
                boardStyles={game.boardStyles}
                fen={game.fen}
                onPieceDrop={game.makeMove}
                onSquareClick={game.handleSquareClick}
                orientation={game.orientation}
              />
            ) : (
              <LoadingBoard />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <CapturedPieces
              blackCaptured={game.captured.blackCaptured}
              score={game.captured.score}
              whiteCaptured={game.captured.whiteCaptured}
            />
            <AnalysisPanel
              analysisBusy={game.analysisBusy}
              onExplain={game.requestExplanation}
              profile={game.profile}
              selectedReplay={game.selectedReplay}
            />
          </div>
        </div>

        <div className="space-y-6">
          <GameControls
            connectRoom={game.connectRoom}
            connectionState={game.connectionState}
            difficulty={game.difficulty}
            gameMode={game.gameMode}
            inviteLink={game.inviteLink}
            onNewGame={() => game.resetBoard()}
            onResign={game.resignGame}
            onUndo={game.undoMove}
            roomCode={game.roomCode}
            setDifficulty={game.setDifficulty}
            setGameMode={(mode) => game.resetBoard(mode)}
            setRoomCode={game.setRoomCode}
          />
          <MoveList moves={game.moveHistory} />
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Recent replays</p>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  History
                </p>
              </div>
              {game.gameHistory.length === 0 ? (
                <EmptyState
                  title="No finished games yet"
                  description="Finish one match and the board will start building a replayable history."
                />
              ) : (
                game.gameHistory.slice(0, 4).map((entry) => (
                  <button
                    key={entry.id}
                    className="w-full rounded-[24px] border border-white/8 bg-white/4 p-4 text-left transition hover:border-[var(--accent)]"
                    onClick={() => {
                      game.setSelectedReplayId(entry.id);
                      game.setReplayPly(entry.moves.length);
                    }}
                    type="button"
                  >
                    <p className="font-semibold">
                      {entry.mode.toUpperCase()} | {entry.opening}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {entry.result} | {entry.moves.length} plies
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
