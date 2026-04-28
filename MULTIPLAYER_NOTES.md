# Multiplayer Notes

## Implemented behavior

- Real-time multiplayer rooms are created with `POST /api/multiplayer/rooms`.
- A second authenticated player joins with `POST /api/multiplayer/rooms/{room_id}/join`.
- Room state is kept server-side in memory and includes:
  - `room_id`
  - `white_player_id`
  - `black_player_id`
  - `current_fen`
  - `moves`
  - `status`
  - `disconnected_players`
- The room creator is always assigned White.
- The second player is always assigned Black.
- Extra users are rejected once the room already has two players.
- WebSocket connections at `/api/ws/games/{room_id}` require a valid JWT.
- The backend validates room membership, side ownership, turn order, and legal chess moves before broadcasting state.
- Clients no longer authoritatively advance online games; they only apply server-confirmed room snapshots.
- Reconnecting players receive the full current room snapshot, including FEN, move list, assigned color, room status, and any persisted game id for that player.
- Resignation is supported over the socket and finishes the room immediately.
- Checkmate and draw conditions are detected on the server via the room’s authoritative chess board.

## Persistence behavior

- When a multiplayer game finishes, the backend persists completed games through the existing `POST /api/games` service layer logic rather than a separate match store.
- Because the current schema supports a single `user_id` per `games` row, the backend writes one completed `multiplayer` game row for White and one completed `multiplayer` game row for Black.
- The frontend receives the current player’s persisted game id in the room snapshot after finish, so existing post-game analysis can still target the saved record.

## Current limitations

- Room state is in-process memory only. Restarting the FastAPI process clears active rooms.
- Multiplayer rooms are not persisted to PostgreSQL yet.
- Completed multiplayer rows are not relationally linked to each other in the current schema; they are parallel per-user records.
- Spectators are rejected instead of supported.
- WebSocket auth currently uses the JWT as a query parameter because browsers cannot set arbitrary authorization headers for standard WebSocket connections.
- Disconnect tracking is durable only for the lifetime of the current process.
- There is no cross-process room coordination, so this implementation assumes a single backend instance.

## Reconnect behavior

- A disconnected player remains assigned to the room.
- The room keeps its current board, move history, and status while that player is offline.
- On reconnect, the server removes that player from `disconnected_players` and sends the latest authoritative room snapshot immediately.
- If the game already finished, reconnect still returns the finished room snapshot.

## Future recommendation

- Move room state and pub/sub fanout to Redis before scaling beyond a single process.
- Redis should be the next step for:
  - shared room state across instances
  - reconnect resilience across deploys/restarts
  - presence tracking
  - fanout without per-process socket silos
