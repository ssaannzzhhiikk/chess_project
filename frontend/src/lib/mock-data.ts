export const appStorageKeys = {
  theme: "endgame-theme",
  profile: "endgame-profile",
  history: "endgame-history",
} as const;

export type Profile = {
  username: string;
  city: string;
  rating: number;
  xp: number;
  level: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  isPro: boolean;
  email: string;
  achievements: string[];
};

export type LeaderboardEntry = {
  username: string;
  city: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  level: number;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
};

export const defaultProfile: Profile = {
  username: "Mira",
  city: "Almaty",
  rating: 1240,
  xp: 160,
  level: 2,
  wins: 3,
  losses: 1,
  draws: 1,
  streak: 2,
  isPro: false,
  email: "mira@endgame.dev",
  achievements: ["first-win", "grinder"],
};

export const achievements: Record<string, Achievement> = {
  "first-win": {
    id: "first-win",
    name: "First Win",
    description: "Turn your first victory into momentum.",
  },
  grinder: {
    id: "grinder",
    name: "Grinder",
    description: "Complete five total games.",
  },
  "calm-finisher": {
    id: "calm-finisher",
    name: "Calm Finisher",
    description: "Win without recording a blunder.",
  },
  strategist: {
    id: "strategist",
    name: "Strategist",
    description: "Find three engine-best moves in one game.",
  },
};

export const navLinks = [
  { href: "/play", label: "Play" },
  { href: "/analysis", label: "Analysis" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

export const landingFeatures = [
  {
    title: "AI Coach",
    description:
      "Spot blunders, review best moves, and turn engine output into practical lessons.",
  },
  {
    title: "Multiplayer Rooms",
    description:
      "Create a link, invite a friend, and keep the match synced in real time.",
  },
  {
    title: "Progress Tracking",
    description:
      "Level up with XP, streaks, achievements, and a profile built around improvement.",
  },
  {
    title: "Leaderboard",
    description:
      "Compete globally or own your city table with rating-forward rankings.",
  },
];
