from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db_session
from .dependencies import get_current_user
from .models import Game, User
from .persistence_schemas import (
    AnalyzeGameRequest,
    AnalyzeGameResponse,
    AuthResponse,
    CoachInsightCreate,
    CoachInsightRead,
    GameCreate,
    GameCreateRequest,
    GameRead,
    LeaderboardEntryRead,
    LeaderboardSort,
    ProfileRead,
    UpgradeResponse,
    UserCreate,
    UserLogin,
    UserRead,
)
from .schemas import (
    CoachExplanationRequest,
    CoachExplanationResponse,
    RoomMove,
)
from .services.coach_service import explain_move
from .services.game_analysis import analyze_game_content
from .services.persistence import (
    DuplicateEmailError,
    InvalidCredentialsError,
    authenticate_user,
    build_auth_response,
    create_game as create_game_service,
    create_user as create_user_service,
    get_coach_insight_by_game_id,
    get_leaderboard,
    get_profile as get_profile_service,
    get_user_games,
    save_coach_insight,
    upgrade_user_to_pro,
)

router = APIRouter(prefix="/api")
connections: dict[str, set[WebSocket]] = defaultdict(set)


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


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade_account(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> UpgradeResponse:
    upgraded_user = await upgrade_user_to_pro(session, current_user)
    return UpgradeResponse(message="Pro access unlocked", user=upgraded_user)


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


@router.post("/analyze-game", response_model=AnalyzeGameResponse)
async def analyze_game(
    payload: AnalyzeGameRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AnalyzeGameResponse:
    moves: list[str] | None = None
    pgn = payload.pgn or ""

    if payload.game_id is not None:
        game = await session.get(Game, payload.game_id)
        if game is None or game.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
        pgn = game.pgn
        moves = [move for move in game.moves if isinstance(move, str)]

    analysis = analyze_game_content(pgn, moves=moves)

    if payload.game_id is None:
        return analysis

    saved_insight = await save_coach_insight(
        session,
        CoachInsightCreate(
            game_id=payload.game_id,
            summary=analysis.summary,
            mistakes_count=analysis.mistakes_count,
            blunders_count=analysis.blunders_count,
            best_moves=analysis.best_moves,
        ),
    )
    return AnalyzeGameResponse(
        summary=saved_insight.summary,
        mistakes_count=saved_insight.mistakes_count,
        blunders_count=saved_insight.blunders_count,
        best_moves=[str(move) for move in saved_insight.best_moves],
    )


@router.get("/games/{game_id}/analysis", response_model=CoachInsightRead)
async def read_game_analysis(
    game_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CoachInsightRead:
    game = await session.get(Game, game_id)
    if game is None or game.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    insight = await get_coach_insight_by_game_id(session, game_id)
    if insight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return insight


@router.get("/leaderboard", response_model=list[LeaderboardEntryRead])
async def leaderboard(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    sort_by: LeaderboardSort = "xp",
    limit: int = 20,
) -> list[LeaderboardEntryRead]:
    limit = min(max(limit, 1), 100)
    return await get_leaderboard(session, sort_by=sort_by, limit=limit)


@router.post("/coach/explain", response_model=CoachExplanationResponse)
async def coach_explain(
    payload: CoachExplanationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CoachExplanationResponse:
    del current_user
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
