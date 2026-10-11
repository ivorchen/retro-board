-- Retro Board initial schema.
--
-- Portability contract: this file must run unmodified on SQLite (via
-- node:sqlite, local dev) AND on Postgres (future). Rules followed here:
--   * TEXT primary keys holding UUIDs (no SERIAL, no UUID type, no AUTOINCREMENT)
--   * Timestamps as TEXT ISO-8601 UTC strings, always supplied by the DAL
--     (no CURRENT_TIMESTAMP / strftime() / now() defaults — formats differ)
--   * Booleans as INTEGER 0/1 (Postgres BOOLEAN accepts 0/1 literals, and the
--     DAL casts on read; keeps both engines happy without casts in SQL)
--   * JSON blobs (topics, settings) as TEXT holding JSON (jsonb on Postgres later)
--   * Only standard DDL: CREATE TABLE IF NOT EXISTS, REFERENCES with
--     ON DELETE actions, CREATE INDEX IF NOT EXISTS.
-- The data-access layer (server/db) is the only thing that talks to these
-- tables, and it always supplies ids/timestamps explicitly.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  github_id TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_tokens(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  host_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  topics TEXT NOT NULL DEFAULT '["went","improve","ideas"]',
  current_topic_index INTEGER NOT NULL DEFAULT 0,
  current_phase TEXT NOT NULL DEFAULT 'write',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
-- settings JSON shape:
--   {
--     "voteCompletions": { "<topicId>": ["<memberId>", ...] },
--     "timer": { "endsAt": "<iso>" | null, "seconds": 300, "running": false }
--   }

CREATE TABLE IF NOT EXISTS session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT,
  alias TEXT NOT NULL,
  is_host INTEGER NOT NULL DEFAULT 0,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  join_token_hash TEXT,
  joined_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_session ON session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON session_members(user_id);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  member_id TEXT REFERENCES session_members(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_session ON cards(session_id);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_themes_session ON themes(session_id);

CREATE TABLE IF NOT EXISTS theme_cards (
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_theme_cards_card ON theme_cards(card_id);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES session_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_theme ON votes(theme_id);
-- NOTE: no UNIQUE(theme_id, member_id): members may cast several of their
-- 5-per-topic votes on the same theme (matches the original app's votesBy).

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  owner_alias TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_session ON action_items(session_id);
