"use client";

import { FlipHorizontal2 } from "lucide-react";

import { BoardAppearancePanel } from "@/components/chess/board-appearance-panel";
import { CapturedPieces } from "@/components/chess/captured-pieces";
import { ChessBoard } from "@/components/chess/chess-board";
import { GameControls } from "@/components/chess/game-controls";
import { GameStatus } from "@/components/chess/game-status";
import { LoadingBoard } from "@/components/chess/loading-board";
import { MoveList } from "@/components/chess/move-list";
import { Button } from "@/components/ui/button";
import { useChessGame } from "./use-chess-game";

export function GameBoardPage() {
  const game = useChessGame();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            Chess game
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Board</h1>
        </div>
        <Button
          onClick={() =>
            game.setOrientation(game.orientation === "white" ? "black" : "white")
          }
          variant="secondary"
        >
          <FlipHorizontal2 className="h-4 w-4" />
          Flip board
        </Button>
      </div>

      <GameStatus
        aiThinking={game.aiThinking}
        status={game.displayStatus}
        stockfishError={game.stockfishError}
        stockfishReady={game.stockfishReady}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {game.hydrated ? (
            <ChessBoard
              allowDragging={
                !game.aiThinking &&
                !game.replayMode &&
                !(game.gameMode === "online" && !game.onlineConnected)
              }
              boardStyles={game.boardStyles}
              boardTheme={game.boardTheme}
              fen={game.boardFen}
              onPieceDrop={game.makeMove}
              onSquareClick={game.handleSquareClick}
              orientation={game.orientation}
              pieceSkin={game.pieceSkin}
            />
          ) : (
            <LoadingBoard />
          )}

          <CapturedPieces
            blackCaptured={game.displayCaptured.blackCaptured}
            score={game.displayCaptured.score}
            whiteCaptured={game.displayCaptured.whiteCaptured}
          />
        </div>

        <div className="space-y-4">
          <BoardAppearancePanel
            boardTheme={game.boardTheme}
            isPro={game.profile.isPro}
            onBoardThemeChange={game.requestBoardTheme}
            onPieceSkinChange={game.requestPieceSkin}
            pieceSkin={game.pieceSkin}
          />
          <GameControls
            createRoom={game.createRoom}
            connectRoom={game.connectRoom}
            connectionState={game.connectionState}
            difficulty={game.difficulty}
            gameMode={game.gameMode}
            inviteLink={game.inviteLink}
            onNewGame={() => game.resetBoard()}
            onReplayNext={game.stepReplayForward}
            onResign={game.resignGame}
            onUndo={game.replayMode ? game.stepReplayBackward : game.undoMove}
            replayMode={game.replayMode}
            replayMoveCount={game.selectedReplay?.moves.length ?? 0}
            replayPly={game.replayPly}
            roomCode={game.roomCode}
            setDifficulty={game.setDifficulty}
            setGameMode={(mode) => game.resetBoard(mode)}
            setRoomCode={game.setRoomCode}
          />

          <MoveList moves={game.displayMoves} />
        </div>
      </div>
    </div>
  );
}
