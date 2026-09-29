-- Local test fixture only. Generate production migrations with Drizzle from schema.ts.
CREATE TABLE game_rooms (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  listed INTEGER NOT NULL,
  started INTEGER NOT NULL,
  allow_spectators INTEGER NOT NULL,
  host_seen INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_game_rooms_listed ON game_rooms (listed);
CREATE TABLE game_presence (
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  seat INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  PRIMARY KEY (room_id,seat)
);
CREATE TABLE game_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
