from .auth import authenticate_user, build_auth_response, create_access_token
from .coach_insights import save_coach_insight
from .exceptions import DuplicateEmailError, EntityNotFoundError, InvalidCredentialsError, PersistenceError
from .games import create_game, get_user_games
from .profile import get_leaderboard, get_profile
from .users import create_user, get_user_by_email, get_user_by_id

__all__ = [
    "DuplicateEmailError",
    "EntityNotFoundError",
    "InvalidCredentialsError",
    "PersistenceError",
    "authenticate_user",
    "build_auth_response",
    "create_game",
    "create_access_token",
    "create_user",
    "get_leaderboard",
    "get_profile",
    "get_user_by_email",
    "get_user_by_id",
    "get_user_games",
    "save_coach_insight",
]
