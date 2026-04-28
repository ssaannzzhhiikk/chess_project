from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db_session
from .dependencies import get_current_user
from .models import User
from .persistence_schemas import (
    AuthResponse,
    GameCreate,
    GameCreateRequest,
    GameRead,
    LeaderboardEntryRead,
    LeaderboardSort,
    ProfileRead,
    UserCreate,
    UserLogin,
    UserRead,
)
from .schemas import (
    CoachExplanationRequest,
    CoachExplanationResponse,
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
    create_game as create_game_service,
    create_user as create_user_service,
    get_leaderboard,
    get_profile as get_profile_service,
    get_user_games,
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


@router.get("/profile", response_model=ProfileRead)
async def read_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProfileRead:
    profile = await get_profile_service(session, current_user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


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


@router.get("/games", response_model=list[GameRead])
async def list_games(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[GameRead]:
    return await get_user_games(session, current_user.id)


@router.post("/games", response_model=GameRead, status_code=status.HTTP_201_CREATED)
async def create_game(
    payload: GameCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> GameRead:
    game = GameCreate(
        user_id=current_user.id,
        pgn=payload.pgn,
        moves=payload.moves,
        result=payload.result,
        mode=payload.mode,
    )
    return await create_game_service(session, game)


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


@router.get("/leaderboard", response_model=list[LeaderboardEntryRead])
async def leaderboard(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    sort_by: LeaderboardSort = "xp",
    limit: int = 20,
) -> list[LeaderboardEntryRead]:
    limit = min(max(limit, 1), 100)
    return await get_leaderboard(session, sort_by=sort_by, limit=limit)


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
