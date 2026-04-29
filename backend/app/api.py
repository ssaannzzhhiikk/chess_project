from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
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
    MultiplayerGameRead,
    MultiplayerRoomRead,
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
    RoomResignation,
)
from .services.coach_service import explain_move
from .services.game_analysis import analyze_game_content
from .services.multiplayer import (
    MultiplayerActionError,
    MultiplayerSocketError,
    room_manager,
)
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
    get_user_multiplayer_game,
    get_user_multiplayer_games,
    get_user_games,
    save_coach_insight,
    upgrade_user_to_pro,
)

router = APIRouter(prefix="/api")
root_websocket_router = APIRouter()


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


@router.post("/multiplayer/rooms", response_model=MultiplayerRoomRead, status_code=status.HTTP_201_CREATED)
async def create_multiplayer_room(
    current_user: Annotated[User, Depends(get_current_user)],
) -> MultiplayerRoomRead:
    room = await room_manager.create_room(current_user.id)
    return await room_manager.get_room_read(room.room_id, current_user.id)


@router.post("/multiplayer/rooms/{room_id}/join", response_model=MultiplayerRoomRead)
async def join_multiplayer_room(
    room_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> MultiplayerRoomRead:
    room = await room_manager.join_room(room_id, current_user.id)
    await room_manager.broadcast_room_state(room)
    return await room_manager.get_room_read(room.room_id, current_user.id)


@router.get("/multiplayer/games", response_model=list[MultiplayerGameRead])
async def list_multiplayer_games(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[MultiplayerGameRead]:
    return await get_user_multiplayer_games(session, current_user.id)


@router.get("/multiplayer/games/{game_id}", response_model=MultiplayerGameRead)
async def read_multiplayer_game(
    game_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> MultiplayerGameRead:
    game = await get_user_multiplayer_game(session, current_user.id, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multiplayer game not found")
    return game


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
            move_reviews=analysis.move_reviews,
        ),
    )
    return AnalyzeGameResponse(
        summary=saved_insight.summary,
        mistakes_count=saved_insight.mistakes_count,
        blunders_count=saved_insight.blunders_count,
        best_moves=[str(move) for move in saved_insight.best_moves],
        move_reviews=saved_insight.move_reviews,
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
    if insight is not None:
        return insight

    analysis = analyze_game_content(
        game.pgn,
        moves=[move for move in game.moves if isinstance(move, str)],
    )
    return await save_coach_insight(
        session,
        CoachInsightCreate(
            game_id=game_id,
            summary=analysis.summary,
            mistakes_count=analysis.mistakes_count,
            blunders_count=analysis.blunders_count,
            best_moves=analysis.best_moves,
            move_reviews=analysis.move_reviews,
        ),
    )


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


@root_websocket_router.websocket("/ws/games/{room_id}")
@router.websocket("/ws/games/{room_id}")
async def game_room(
    websocket: WebSocket,
    room_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    await websocket.accept()
    token = websocket.query_params.get("token")
    user = await room_manager.resolve_user(session, token)
    if user is None:
        await room_manager.send_error(websocket, "unauthenticated", "Authentication required.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required.")
        return

    try:
        await room_manager.connect(room_id, user.id, websocket)
    except MultiplayerSocketError as exc:
        await room_manager.send_error(websocket, exc.error_code, exc.message)
        await websocket.close(code=exc.ws_code, reason=exc.message)
        return

    try:
        while True:
            message: dict[str, Any] = await websocket.receive_json()
            message_type = message.get("type", "move")

            try:
                if message_type == "move":
                    await room_manager.process_move(session, room_id, user.id, RoomMove.model_validate(message))
                elif message_type == "resign":
                    RoomResignation.model_validate(message)
                    await room_manager.process_resignation(session, room_id, user.id)
                else:
                    await room_manager.send_error(websocket, "unsupported_event", "Unsupported room event.")
            except ValidationError:
                await room_manager.send_error(websocket, "invalid_move_payload", "Invalid move payload.")
            except MultiplayerActionError as exc:
                await room_manager.send_error(websocket, exc.error_code, exc.message)
    except WebSocketDisconnect:
        await room_manager.disconnect(room_id, user.id, websocket)
