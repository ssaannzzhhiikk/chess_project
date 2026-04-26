# Endgame

Endgame is a modern chess product built to feel closer to a competitive training platform than a toy chessboard. It combines polished local play, an AI opponent powered by Stockfish, post-game coaching, replayable history, player progression, leaderboards, and a clear path to real-time multiplayer and monetized Pro features.

## Product Description

The app is designed around three loops:

- Play: local games, AI games, and online room-based games.
- Improve: post-game engine review plus human-language coaching.
- Progress: profiles, XP, achievements, ratings, and leaderboard visibility.

The frontend is a Next.js application with a mobile-first dashboard experience. The backend is organized as a FastAPI service with REST and WebSocket interfaces so the product can scale from a single-player demo into authenticated multiplayer.

## Features

- Interactive drag-and-drop chessboard with full legal move validation using `chess.js`
- Local multiplayer and AI matches with Stockfish-backed move selection
- Post-game AI Coach with mistake detection, best-move suggestions, and optional OpenAI explanations
- Replayable game history with move timeline scrubbing
- Profiles with rating, XP, level, win/loss/draw stats, and city identity
- Global and city-based leaderboard views
- Achievement system and Pro feature gating
- Dark/light theme and responsive UI
- FastAPI backend structure for auth, game APIs, leaderboard endpoints, and WebSocket rooms

## Tech Stack

- Frontend: Next.js App Router, React, Tailwind CSS
- Backend: FastAPI, WebSockets, JWT-ready auth structure
- Database target: PostgreSQL
- Chess engine: Stockfish WASM
- Move validation: `chess.js`
- AI explanation: OpenAI Responses API

## Architecture

### Frontend

- `frontend/src/app`: routing, layout, API route for coach explanations
- `frontend/src/components/chess`: product UI and chess experience
- `frontend/src/hooks`: client-side engine orchestration
- `frontend/public/stockfish`: local Stockfish worker assets

### Backend

- `backend/app/main.py`: FastAPI entrypoint
- `backend/app/api.py`: REST and WebSocket routes
- `backend/app/schemas.py`: API contracts
- `backend/app/store.py`: demo repository layer
- `backend/app/services`: chess and coach services
- `backend/sql/schema.sql`: PostgreSQL schema target for production persistence

## Why This Project Is Unique

Most chess demos stop at “you can move pieces.” Endgame is product-shaped:

- It treats analysis as a user experience, not just a raw engine score.
- It includes progression, city identity, and monetization hooks from the start.
- It cleanly separates the real-time multiplayer path from the single-player learning loop.
- It keeps the frontend demo usable even before every external service is configured.

## Running The App

### Frontend

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` to `.env.local` and optionally add `OPENAI_API_KEY`
4. `npm run dev`

### Backend

1. Install Python 3.11+
2. `cd backend`
3. `python -m venv .venv`
4. `.venv\\Scripts\\activate`
5. `pip install -r requirements.txt`
6. `uvicorn app.main:app --reload`

The backend in this repo is organized as a working FastAPI demo service with in-memory storage. The included PostgreSQL schema shows the production persistence target.

