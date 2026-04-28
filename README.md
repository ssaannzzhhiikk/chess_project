
# ♟️ Endgame — AI Chess Training Platform

**Endgame** is a modern chess platform designed not as a simple board, but as a **training-focused product**.
It combines gameplay, AI-powered analysis, real-time multiplayer, and progression systems into a single experience.

---

## Overview

Endgame is built around three core loops:

```text
Play → Analyze → Improve → Progress
```

* **Play** — against AI, locally, or in real-time multiplayer
* **Analyze** — engine + AI explanations of mistakes
* **Improve** — learn from personalized feedback
* **Progress** — track rating, XP, and leaderboard position

---

## Key Features

### Gameplay

* Drag-and-drop chessboard with full move validation (`chess.js`)
* Single-player AI matches powered by **Stockfish**
* Real-time multiplayer using **WebSockets**
* Room-based matchmaking (create/join by link)
* Reconnect support with state restoration

---

### AI Coaching

* Post-game analysis:

  * mistakes / blunders detection
  * best move suggestions
* Human-readable explanations (OpenAI)
* Player personality insights
* Visual mistake highlighting
* **Pro features**:

  * deeper explanations
  * alternative lines
  * training insights

---

### Progression & Social

* User profiles:

  * XP, level, wins/losses/draws
* Global leaderboard
* Achievement system
* Game history with replay
* City-based identity (social layer)

---

### Monetization (Mock)

* Pro subscription system
* Feature gating:

  * advanced AI analysis
  * premium UI themes
  * training features

---

## Architecture

### Frontend (Next.js)

```text
frontend/
├── src/app              → routing (App Router)
├── src/features         → domain features (game, auth, profile)
├── src/components       → UI components
├── src/lib              → API client & utilities
├── public/stockfish     → WASM chess engine
```

---

### Backend (FastAPI)

```text
backend/
├── app/main.py          → entrypoint
├── app/api.py           → REST + WebSocket routes
├── app/models           → SQLAlchemy models
├── app/services         → business logic
├── app/db               → database layer
├── alembic/             → migrations
```

---

### 🔌 System Design

```text
Frontend (Vercel)
        ↓
FastAPI Backend (Railway)
        ↓
PostgreSQL + Redis (Railway)
        ↓
Stockfish + OpenAI
```

---

## ⚙️ Tech Stack

### Frontend

* Next.js (App Router)
* React
* Tailwind CSS

### Backend

* FastAPI
* WebSockets
* JWT Authentication
* SQLAlchemy (async)
* Alembic

### Infrastructure

* PostgreSQL
* Redis
* Vercel (frontend)
* Railway (backend)

### Chess & AI

* `chess.js` — move validation
* Stockfish (WASM)
* OpenAI API — explanations

---

## What Makes It Different

Endgame is **not just a chess app**:

* Focus on **learning, not just playing**
* Combines:

  * real-time multiplayer
  * AI coaching
  * progression systems
* Designed as a **product**, not a demo
* Built with **scalable architecture from the start**

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

### Environment Variables

#### Backend

```env
DATABASE_URL=
JWT_SECRET_KEY=
REDIS_URL=
CORS_ORIGINS=
OPENAI_API_KEY=
```

---

#### Frontend

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_CHESS_WS_URL=
```

---

## Deployment

### Frontend

* Hosted on **Vercel**

### Backend

* Hosted on **Railway**

### Services

* PostgreSQL + Redis (Railway)

---

## Future Improvements

* Rating system (ELO)
* Advanced training modes (puzzles, drills)
* Mobile optimization
* Stripe integration for Pro

---


## Author

**Sanzhar Omarkhanov**
GitHub: [https://github.com/ssaannzzhhiikk](https://github.com/ssaannzzhhiikk)

---

## Final Note

This project demonstrates:

* Fullstack architecture
* Real-time systems (WebSockets)
* AI integration
* Product thinking
* Production-ready deployment