# Environment Setup

## Overview

This project is split into:

- `backend/` for FastAPI, PostgreSQL persistence, Redis-backed multiplayer state, and AI coach APIs
- `frontend/` for the Next.js web app

## Required backend variables

Set these in `backend/.env`:

- `DATABASE_URL`
- `JWT_SECRET_KEY`

Recommended for local multiplayer stability:

- `REDIS_URL`

Optional:

- `OPENAI_API_KEY`
- `CORS_ORIGINS`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

Reference template: [backend/.env.example](/c:/Users/user/Desktop/chess_project/backend/.env.example:1)

## Required frontend variables

Set these in `frontend/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CHESS_WS_URL`

Reference template: [frontend/.env.example](/c:/Users/user/Desktop/chess_project/frontend/.env.example:1)

## Local Docker services

The backend repo includes Docker services for PostgreSQL and Redis in [backend/docker-compose.yml](/c:/Users/user/Desktop/chess_project/backend/docker-compose.yml:1).

Start them from the `backend/` directory:

```powershell
docker compose up -d postgres redis
```

Default local ports:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## Local development defaults

Backend local defaults assume:

- FastAPI on `http://localhost:8000`
- PostgreSQL on `postgresql+asyncpg://postgres:postgres@localhost:5433/chess_app`
- Redis on `redis://localhost:6379/0`

Frontend local defaults assume:

- API base URL: `http://localhost:8000/api`
- WebSocket base URL: `ws://localhost:8000`

## Production notes

- Replace `JWT_SECRET_KEY` with a long random secret.
- Set explicit production `CORS_ORIGINS`.
- Point `DATABASE_URL` and `REDIS_URL` at managed services.
- Keep `OPENAI_API_KEY` unset unless AI coach explanations are required in that environment.
