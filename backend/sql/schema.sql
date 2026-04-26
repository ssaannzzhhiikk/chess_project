create table if not exists users (
  id uuid primary key,
  username varchar(32) not null unique,
  city varchar(64) not null,
  rating integer not null default 1200,
  xp integer not null default 0,
  level integer not null default 1,
  is_pro boolean not null default false,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists achievements (
  id varchar(32) primary key,
  name varchar(64) not null,
  description text not null
);

create table if not exists user_achievements (
  user_id uuid not null references users(id) on delete cascade,
  achievement_id varchar(32) not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists games (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  mode varchar(16) not null,
  result varchar(16) not null,
  pgn text not null,
  moves jsonb not null,
  opening varchar(128),
  city varchar(64) not null,
  created_at timestamptz not null default now()
);

create table if not exists coach_insights (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  ply integer not null,
  san varchar(32) not null,
  severity varchar(16) not null,
  best_move varchar(16) not null,
  evaluation integer not null,
  delta integer not null,
  explanation text
);

