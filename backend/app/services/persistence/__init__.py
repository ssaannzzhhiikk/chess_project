from .auth import authenticate_user, build_auth_response, create_access_token
from .coach_insights import get_coach_insight_by_game_id, save_coach_insight
from .exceptions import DuplicateEmailError, EntityNotFoundError, InvalidCredentialsError, PersistenceError
from .games import create_game, get_user_games
from .multiplayer_games import create_multiplayer_game, get_user_multiplayer_game, get_user_multiplayer_games
from .profile import get_leaderboard, get_profile
from .users import create_user, get_user_by_email, get_user_by_id, upgrade_user_to_pro

__all__ = [
    "DuplicateEmailError",
    "EntityNotFoundError",
    "InvalidCredentialsError",
    "PersistenceError",
    "authenticate_user",
    "build_auth_response",
    "create_game",
    "create_multiplayer_game",
    "create_access_token",
    "create_user",
    "get_coach_insight_by_game_id",
    "get_leaderboard",
    "get_profile",
    "get_user_by_email",
    "get_user_by_id",
    "get_user_games",
    "get_user_multiplayer_game",
    "get_user_multiplayer_games",
    "save_coach_insight",
    "upgrade_user_to_pro",
]
