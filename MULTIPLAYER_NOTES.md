# Multiplayer Notes

## Implemented behavior

- Real-time multiplayer rooms are created with `POST /api/multiplayer/rooms`.
- A second authenticated player joins with `POST /api/multiplayer/rooms/{room_id}/join`.
- WebSocket connections at `/api/ws/games/{room_id}` require a valid JWT.
- The backend validates room membership, side ownership, turn order, and legal chess moves before broadcasting state.
- Reconnecting players receive the full current room snapshot, including FEN, move list, assigned color, room status, and the persisted multiplayer game id after finish.
- Resignation, checkmate, and draw completion all finish the room on the server.

## Persistence model

- Multiplayer completion now persists into a dedicated `multiplayer_games` table instead of duplicating two rows in `games`.
- Each `multiplayer_games` row stores:
  - `white_user_id`
  - `black_user_id`
  - `winner_user_id`
  - `result`
  - `pgn`
  - `moves`
  - `created_at`
- The existing `games` table remains unchanged for single-player and existing per-user game history behavior.
- The room snapshot still exposes one `persisted_game_id`, but it now points to the shared `multiplayer_games.id`.

## Multiplayer read APIs

- `GET /api/multiplayer/games` returns multiplayer matches for the authenticated participant.
- `GET /api/multiplayer/games/{id}` returns a single multiplayer match only if the authenticated user was White or Black in that game.

## Current limitations

- Room state is still in-process memory only. Restarting the FastAPI process clears active rooms.
- Active rooms are not restored from PostgreSQL after restart.
- WebSocket auth still uses the JWT as a query parameter because browsers cannot set arbitrary authorization headers for standard WebSocket connections.
- Spectators are rejected instead of supported.
- There is still no cross-process room coordination, so this implementation assumes a single backend instance.
- Multiplayer analysis is still not wired into the separate `multiplayer_games` table; existing coach-analysis persistence remains tied to the original `games` table.

## Reconnect behavior

- A disconnected player remains assigned to the room.
- The room keeps its current board, move history, and status while that player is offline.
- On reconnect, the server removes that player from `disconnected_players` and sends the latest authoritative room snapshot immediately.
- If the game already finished, reconnect still returns the finished room snapshot, including the shared persisted multiplayer game id.

## Future recommendation

- Move room state and pub/sub fanout to Redis before scaling beyond a single process.
- If multiplayer analysis/history needs to converge with the existing profile/coach stack, add explicit linking between `multiplayer_games` and downstream analysis records instead of reusing the single-player `games` table.
