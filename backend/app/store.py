from collections import defaultdict

from .schemas import Achievement, GameRecord, UserProfile


ACHIEVEMENTS = {
    "first-win": Achievement(
        id="first-win",
        name="First Win",
        description="Win your first match.",
    ),
    "calm-finisher": Achievement(
        id="calm-finisher",
        name="Calm Finisher",
        description="Win without making a blunder.",
    ),
    "grinder": Achievement(
        id="grinder",
        name="Grinder",
        description="Complete five games.",
    ),
}


class DemoStore:
    def __init__(self) -> None:
        self.users: dict[str, UserProfile] = {}
        self.games: dict[str, GameRecord] = {}
        self.rooms: dict[str, set] = defaultdict(set)

    def upsert_user(self, profile: UserProfile) -> UserProfile:
        self.users[profile.id] = profile
        return profile

    def get_user(self, user_id: str) -> UserProfile | None:
        return self.users.get(user_id)

    def add_game(self, game: GameRecord) -> GameRecord:
        self.games[game.id] = game
        return game

    def list_games(self, user_id: str) -> list[GameRecord]:
        return sorted(
            [game for game in self.games.values() if game.user_id == user_id],
            key=lambda game: game.created_at,
            reverse=True,
        )

    def leaderboard(self, city: str | None = None) -> list[UserProfile]:
        players = list(self.users.values())
        if city:
            players = [player for player in players if player.city.lower() == city.lower()]
        return sorted(players, key=lambda player: (player.rating, player.xp), reverse=True)


store = DemoStore()

