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

export const leaderboardSeed: LeaderboardEntry[] = [
  { username: "Arun", city: "Mumbai", rating: 1688, xp: 780, wins: 31, losses: 14, level: 7 },
  { username: "Lina", city: "London", rating: 1622, xp: 720, wins: 28, losses: 16, level: 7 },
  { username: "Noor", city: "Dubai", rating: 1584, xp: 650, wins: 23, losses: 11, level: 6 },
  { username: "Emir", city: "Almaty", rating: 1498, xp: 610, wins: 21, losses: 18, level: 6 },
  { username: "Taro", city: "Tokyo", rating: 1466, xp: 560, wins: 19, losses: 12, level: 5 },
  { username: "Safa", city: "Istanbul", rating: 1418, xp: 500, wins: 17, losses: 10, level: 5 },
];

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

export const analysisSummary = {
  accuracy: 86,
  blunders: 1,
  mistakes: 2,
  bestMoves: 9,
};

export const analysisRows = [
  {
    ply: 7,
    move: "Nf3",
    quality: "Best",
    eval: "+0.7",
    explanation: "Develops with tempo and prepares quick castling.",
    bestMove: "Nf3",
  },
  {
    ply: 12,
    move: "Bc4",
    quality: "Good",
    eval: "+0.5",
    explanation: "Natural pressure, though the engine preferred c3 first.",
    bestMove: "c3",
  },
  {
    ply: 19,
    move: "Qe2",
    quality: "Inaccuracy",
    eval: "-0.2",
    explanation: "It slows your queenside coordination and gives Black time.",
    bestMove: "Re1",
  },
  {
    ply: 24,
    move: "g4",
    quality: "Mistake",
    eval: "-1.9",
    explanation: "Overextends the king shield without a forcing attack.",
    bestMove: "h3",
  },
  {
    ply: 31,
    move: "Rxe5",
    quality: "Blunder",
    eval: "-4.8",
    explanation: "Drops the exchange to a tactical skewer on the back rank.",
    bestMove: "Qd3",
  },
];

export const recentGames = [
  { id: "g1", opponent: "Arun", result: "Win", opening: "Italian Game", date: "Today", ratingDelta: "+14" },
  { id: "g2", opponent: "Lina", result: "Loss", opening: "Sicilian Defense", date: "Yesterday", ratingDelta: "-9" },
  { id: "g3", opponent: "Noor", result: "Draw", opening: "Queen's Gambit", date: "Apr 24", ratingDelta: "+2" },
];

