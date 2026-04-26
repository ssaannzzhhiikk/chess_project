from ..schemas import CoachInsight, UserProfile


def calculate_level(xp: int) -> int:
    return max(1, xp // 120 + 1)


def apply_game_result(profile: UserProfile, result: str, insights: list[CoachInsight]) -> UserProfile:
    xp_gain = 40
    if result == "white":
        profile.wins += 1
        profile.rating += 14
        xp_gain += 20
    elif result == "black":
        profile.losses += 1
        profile.rating = max(800, profile.rating - 8)
    else:
        profile.draws += 1
        profile.rating += 2
        xp_gain += 10

    if insights and not any(insight.severity == "blunder" for insight in insights):
        xp_gain += 15
        if "calm-finisher" not in profile.achievements:
            profile.achievements.append("calm-finisher")

    total_games = profile.wins + profile.losses + profile.draws + 1
    if profile.wins >= 1 and "first-win" not in profile.achievements:
        profile.achievements.append("first-win")
    if total_games >= 5 and "grinder" not in profile.achievements:
        profile.achievements.append("grinder")

    profile.xp += xp_gain
    profile.level = calculate_level(profile.xp)
    return profile
