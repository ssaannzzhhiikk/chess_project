from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db_session
from .dependencies import get_current_user
from .models import User
from .persistence_schemas import AuthResponse, UserCreate, UserLogin, UserRead
from .schemas import (
    CoachExplanationRequest,
    CoachExplanationResponse,
    CreateGameRequest,
    FinishGameRequest,
    GameRecord,
    LeaderboardEntry,
    LoginRequest,
    LoginResponse,
    RoomMove,
    UserProfile,
)
from .services.chess_service import apply_game_result
from .services.coach_service import explain_move
from .services.persistence import (
    DuplicateEmailError,
    InvalidCredentialsError,
    authenticate_user,
    build_auth_response,
    create_user as create_user_service,
)
from .store import store

router = APIRouter(prefix="/api")
connections: dict[str, set[WebSocket]] = defaultdict(set)


def encode_token(profile: UserProfile) -> str:
    return jwt.encode({"sub": profile.id, "username": profile.username}, settings.jwt_secret, algorithm="HS256")


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthResponse:
    try:
        user = await create_user_service(session, payload)
    except DuplicateEmailError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc
    return build_auth_response(user)


@router.post("/auth/login", response_model=AuthResponse)
async def login(
    payload: UserLogin,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthResponse:
    try:
        user = await authenticate_user(session, payload)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return build_auth_response(user)


@router.get("/auth/me", response_model=UserRead)
async def read_current_user(current_user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/auth/demo-login", response_model=LoginResponse)
async def demo_login(payload: LoginRequest) -> LoginResponse:
    existing = next(
        (user for user in store.users.values() if user.username.lower() == payload.username.lower()),
        None,
    )
    profile = existing or UserProfile(username=payload.username, city=payload.city)
    store.upsert_user(profile)
    return LoginResponse(access_token=encode_token(profile), profile=profile)


@router.get("/profiles/{user_id}", response_model=UserProfile)
async def get_profile(user_id: str) -> UserProfile:
    profile = store.get_user(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("/games/{user_id}", response_model=list[GameRecord])
async def list_games(user_id: str) -> list[GameRecord]:
    return store.list_games(user_id)


@router.post("/games", response_model=GameRecord)
async def create_game(payload: CreateGameRequest) -> GameRecord:
    user = store.get_user(payload.user_id)
    game = GameRecord(
        user_id=payload.user_id,
        mode=payload.mode,
        result="draw",
        pgn="",
        moves=[],
        opening=None,
        city=user.city if user else "Unknown",
    )
    return store.add_game(game)


@router.post("/games/{game_id}/finish", response_model=GameRecord)
async def finish_game(game_id: str, payload: FinishGameRequest) -> GameRecord:
    game = store.games.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    game.result = payload.result
    game.pgn = payload.pgn
    game.moves = payload.moves
    game.opening = payload.opening
    store.games[game_id] = game

    profile = store.get_user(game.user_id)
    if profile:
        store.upsert_user(apply_game_result(profile, payload.result, payload.insights))
    return game


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(city: str | None = None) -> list[LeaderboardEntry]:
    return [
        LeaderboardEntry(
            username=player.username,
            city=player.city,
            rating=player.rating,
            xp=player.xp,
            wins=player.wins,
            losses=player.losses,
            level=player.level,
        )
        for player in store.leaderboard(city)
    ]


@router.post("/coach/explain", response_model=CoachExplanationResponse)
async def coach_explain(payload: CoachExplanationRequest) -> CoachExplanationResponse:
    return CoachExplanationResponse(explanation=await explain_move(payload))


@router.websocket("/ws/games/{room_id}")
async def game_room(websocket: WebSocket, room_id: str) -> None:
    await websocket.accept()
    connections[room_id].add(websocket)
    try:
        while True:
            message: dict[str, Any] = await websocket.receive_json()
            room_move = RoomMove.model_validate(message)
            for peer in list(connections[room_id]):
                if peer is websocket:
                    continue
                await peer.send_json(room_move.model_dump())
    except WebSocketDisconnect:
        connections[room_id].discard(websocket)
