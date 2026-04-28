# Legacy Audit

This audit covers:
- every backend usage of `backend/app/store.py`
- every frontend dependency on demo/mock backend routes
- related mock-only frontend assets that are still present

No code was changed as part of this audit.

## Executive Summary

- The current frontend does **not** call any `DemoStore`-backed backend route.
- The active DB/auth/game/AI/paywall flows are separate from `DemoStore`.
- The backend `WebSocket` multiplayer route is still active, but it does **not** use `DemoStore`.
- Most `DemoStore` code is now removable once the team is ready to delete legacy routes.
- The main temporary item to keep for multiplayer is the WebSocket route and its message schema, not the in-memory store.

## Backend: DemoStore and Legacy Route Inventory

| Route/File | Why It Exists | Frontend Uses It? | Classification | Recommended Action |
|---|---|---:|---|---|
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) | Legacy in-memory container for demo auth/profile/game state from the pre-DB flow. | No direct frontend usage. Only referenced indirectly by legacy backend routes below. | Safe to remove now | Remove together with the legacy demo routes that import it. |
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `POST /api/auth/demo-login` | Old demo login flow that creates a `UserProfile` in memory and signs a token without DB persistence. | No. The login page uses real `POST /api/auth/login`. | Safe to remove now | Delete after confirming no external consumer depends on demo auth. |
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `GET /api/profiles/{user_id}` | Old in-memory profile lookup for demo users. | No. The app uses real `GET /api/auth/me` and `GET /api/profile`. | Safe to remove now | Delete with `demo-login`. |
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `POST /api/games/{game_id}/finish` | Old in-memory game completion path that mutates `store.games` and updates demo profile progression. | No. The play flow now uses `POST /api/games`, `POST /api/analyze-game`, and `GET /api/games/{id}/analysis`. | Safe to remove now | Delete when cleaning legacy game flow; rebuild any future finish endpoint on top of DB persistence instead of keeping this version. |
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `encode_token(profile: UserProfile)` | Helper for demo-login JWT creation. | No direct frontend usage. Only used by `POST /api/auth/demo-login`. | Safe to remove now | Delete with `demo-login`. |
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) `DemoStore.users`, `upsert_user()`, `get_user()` | In-memory profile storage for demo users and legacy finish flow. | No direct usage; only via legacy routes above. | Safe to remove now | Remove with demo profile/login/finish routes. |
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) `DemoStore.games` | In-memory game storage for `POST /api/games/{game_id}/finish`. | No direct usage; only via legacy finish route. | Safe to remove now | Remove with legacy finish route. |
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) `DemoStore.rooms` | Intended room registry for older multiplayer/demo design. | No. Current WebSocket handler uses `connections` in `api.py`, not `store.rooms`. | Safe to remove now | Remove; it is currently dead code. |
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) `add_game()`, `list_games()`, `leaderboard()` | Older demo helpers for game/leaderboard storage. | No. Current app uses SQL-backed services for games and leaderboard. | Safe to remove now | Remove; no current backend path calls them. |
| [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) `ACHIEVEMENTS` | Old demo achievement metadata constant. | No. Not referenced by current backend or frontend runtime. | Safe to remove now | Remove; fully unused. |
| [backend/app/schemas.py](/c:/Users/user/Desktop/chess_project/backend/app/schemas.py) `UserProfile`, `LoginRequest`, `LoginResponse`, `GameRecord`, `FinishGameRequest`, `CoachInsight` | Legacy schema layer that exists mainly to support demo-login and finish-game flows. | No direct frontend usage of the corresponding legacy routes. | Safe to remove now | Remove after deleting demo-login/profile/finish routes and `apply_game_result()`. |
| [backend/app/services/chess_service.py](/c:/Users/user/Desktop/chess_project/backend/app/services/chess_service.py) `apply_game_result()` | Legacy progression updater for the in-memory finish-game flow. | No. Only used by `POST /api/games/{game_id}/finish`. | Safe to remove now | Remove with legacy finish route and legacy schemas. |

## Backend: Must Keep Temporarily for WebSocket/Multiplayer

These are not `DemoStore` usages, but they are the only legacy-style backend pieces that still matter if multiplayer remains in place.

| Route/File | Why It Exists | Frontend Uses It? | Classification | Recommended Action |
|---|---|---:|---|---|
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `@router.websocket("/ws/games/{room_id}")` | Current real-time move relay for online mode. | Yes. `useChessGame.connectRoom()` opens this socket when online mode is selected. | Must keep temporarily for WebSocket/multiplayer | Keep until multiplayer is rebuilt or replaced. |
| [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py) `connections` map | Runtime peer registry used by the WebSocket route. | Yes, indirectly through the active WebSocket flow. | Must keep temporarily for WebSocket/multiplayer | Keep with the WebSocket route. |
| [backend/app/schemas.py](/c:/Users/user/Desktop/chess_project/backend/app/schemas.py) `RoomMove` | Payload schema for WebSocket message validation/broadcast. | Yes, indirectly through online mode. | Must keep temporarily for WebSocket/multiplayer | Keep with the WebSocket route. |

## Frontend: Demo/Mock Backend Route Dependencies

| Route/File | Why It Exists | Frontend Uses It? | Classification | Recommended Action |
|---|---|---:|---|---|
| [frontend/src/app/api/coach/explain/route.ts](/c:/Users/user/Desktop/chess_project/frontend/src/app/api/coach/explain/route.ts) | Old Next.js local API proxy/mock for coach explanations before the logic moved fully to FastAPI. | No. `useChessGame` now calls `explainCoachMove()` in `frontend/src/lib/api.ts`, which targets backend `POST /api/coach/explain`. | Safe to remove now | Delete once the team confirms no external/manual usage relies on the Next route. |
| `POST /api/auth/demo-login` backend route | Legacy demo backend login path. | No. Login page uses real DB auth, and guest flow just links to `/play` without any backend call. | Safe to remove now | Remove backend route. |
| `GET /api/profiles/{user_id}` backend route | Legacy demo profile lookup. | No current frontend caller. | Safe to remove now | Remove backend route. |
| `POST /api/games/{game_id}/finish` backend route | Legacy demo game finalization. | No current frontend caller. | Safe to remove now | Remove backend route. |

## Frontend: Cosmetic Mock Data Only

These are not backend flows. They are UI/static helpers or unused mock exports.

| Route/File | Why It Exists | Frontend Uses It? | Classification | Recommended Action |
|---|---|---:|---|---|
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `navLinks` | Static navigation config. | Yes. Used by the navbar. | Cosmetic mock data only | Keep or move to a neutral config file later; not urgent. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `landingFeatures` | Static marketing copy for landing page cards. | Yes. Used by landing page only. | Cosmetic mock data only | Keep or move to marketing content config later. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `achievements` | Local label/description map for rendering achievement cards. | Yes. Profile page uses it for presentation. | Cosmetic mock data only | Keep until backend provides achievement metadata or a dedicated frontend config replaces it. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `leaderboardSeed` | Old sample leaderboard entries. | No current imports. | Cosmetic mock data only | Safe to delete whenever cleanup begins. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `analysisSummary` | Old sample analysis summary. | No current imports. | Cosmetic mock data only | Safe to delete whenever cleanup begins. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `analysisRows` | Old sample analysis rows. | No current imports. | Cosmetic mock data only | Safe to delete whenever cleanup begins. |
| [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `recentGames` | Old sample recent-games list. | No current imports. | Cosmetic mock data only | Safe to delete whenever cleanup begins. |

## Notes on Related Non-Route Mock State

These items are related to legacy/mock behavior, but they are **not** backend demo routes:

- [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) `defaultProfile`
  - This is still used as a guest/local fallback in the play flow.
  - It is **not** a backend dependency.
  - It should be evaluated separately from the `DemoStore` cleanup because removing it without replacing guest state would affect the current unauthenticated play experience.

## Recommended Removal Order

1. Remove the dead Next.js route [frontend/src/app/api/coach/explain/route.ts](/c:/Users/user/Desktop/chess_project/frontend/src/app/api/coach/explain/route.ts).
2. Remove backend demo routes in [backend/app/api.py](/c:/Users/user/Desktop/chess_project/backend/app/api.py):
   - `POST /api/auth/demo-login`
   - `GET /api/profiles/{user_id}`
   - `POST /api/games/{game_id}/finish`
3. Remove [backend/app/store.py](/c:/Users/user/Desktop/chess_project/backend/app/store.py) and the now-orphaned legacy helpers:
   - `encode_token()`
   - [backend/app/services/chess_service.py](/c:/Users/user/Desktop/chess_project/backend/app/services/chess_service.py)
   - unused legacy schemas from [backend/app/schemas.py](/c:/Users/user/Desktop/chess_project/backend/app/schemas.py)
4. Keep the WebSocket route and `RoomMove` schema until multiplayer is intentionally replaced.
5. Remove unused cosmetic exports from [frontend/src/lib/mock-data.ts](/c:/Users/user/Desktop/chess_project/frontend/src/lib/mock-data.ts) in a separate low-risk cleanup.
