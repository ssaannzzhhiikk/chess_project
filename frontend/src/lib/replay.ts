import type { StoredGame } from "@/features/game/types";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

const PENDING_REPLAY_KEY = "endgame-pending-replay";

export type PendingReplay = {
  replay: StoredGame;
  ply: number;
};

export function writePendingReplay(payload: PendingReplay) {
  writeStorage(PENDING_REPLAY_KEY, payload);
}

export function readPendingReplay() {
  return readStorage<PendingReplay | StoredGame | null>(PENDING_REPLAY_KEY, null);
}

export function clearPendingReplay() {
  removeStorage(PENDING_REPLAY_KEY);
}
