CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  spotify_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  country TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  token_expires_at INTEGER,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  followers INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES artists(id),
  name TEXT NOT NULL,
  album_image TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  track_id TEXT NOT NULL,
  artist_id TEXT NOT NULL REFERENCES artists(id),
  played_at TEXT NOT NULL,
  day TEXT NOT NULL,
  minutes REAL NOT NULL DEFAULT 0,
  points REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'spotify',
  UNIQUE(user_id, track_id, played_at)
);
CREATE INDEX IF NOT EXISTS idx_plays_user_day ON plays(user_id, day);
CREATE INDEX IF NOT EXISTS idx_plays_artist_day ON plays(artist_id, day);

CREATE TABLE IF NOT EXISTS daily_scores (
  user_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  day TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 0,
  minutes REAL NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  distinct_tracks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, artist_id, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_artist_day ON daily_scores(artist_id, day);
CREATE INDEX IF NOT EXISTS idx_daily_user_day ON daily_scores(user_id, day);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  current INTEGER NOT NULL DEFAULT 0,
  longest INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  rule TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  artist_id TEXT,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge_id, artist_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  artist_id TEXT,
  metric TEXT NOT NULL,
  target REAL NOT NULL,
  bonus_points REAL NOT NULL DEFAULT 0,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  actor_id TEXT,
  artist_id TEXT,
  target_user_id TEXT,
  message TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC);

CREATE TABLE IF NOT EXISTS rank_snapshots (
  user_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  rank INTEGER NOT NULL,
  points REAL NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, artist_id, period_type, period_key)
);
