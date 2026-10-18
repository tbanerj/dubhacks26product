export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL,
  progress_scope TEXT NOT NULL CHECK (progress_scope IN ('demo', 'live')),
  xp INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  email TEXT,
  profile_completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messaging_identities (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  project_scope TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  opted_out INTEGER NOT NULL DEFAULT 0,
  linked_app_user TEXT,
  link_failures INTEGER NOT NULL DEFAULT 0,
  link_failure_window_start TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(channel, project_scope, sender_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES messaging_identities(id) ON DELETE CASCADE,
  provider_conversation_ref TEXT NOT NULL,
  serving_line TEXT,
  phase TEXT NOT NULL,
  area_json TEXT,
  offer_set_id TEXT,
  active_attempt_id TEXT,
  pending_json TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(identity_id, provider_conversation_ref)
);

CREATE TABLE IF NOT EXISTS quest_offer_sets (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_attempts (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  quest_version INTEGER NOT NULL,
  offer_set_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  cancelled_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS evidence_submissions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES quest_attempts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  media_path TEXT,
  content_hash TEXT,
  status TEXT NOT NULL,
  outcome TEXT,
  outcome_source TEXT,
  explanation TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(attempt_id, message_id, attachment_id)
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL UNIQUE,
  quest_id TEXT NOT NULL,
  xp_delta INTEGER NOT NULL,
  collectible_id TEXT NOT NULL,
  source TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, quest_id)
);

CREATE TABLE IF NOT EXISTS collectible_unlocks (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  collectible_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (player_id, collectible_id)
);

CREATE TABLE IF NOT EXISTS inbox_events (
  project_scope TEXT NOT NULL,
  channel TEXT NOT NULL,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_scope, channel, event_id)
);

CREATE TABLE IF NOT EXISTS outbox_messages (
  operation_key TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  route_json TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_category TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_jobs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  app_user_id TEXT NOT NULL,
  messaging_identity_id TEXT,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messaging_preferences (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  reminders_enabled INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL,
  weekdays TEXT NOT NULL DEFAULT '1,3,5',
  local_time TEXT NOT NULL DEFAULT '16:00',
  quiet_start TEXT NOT NULL DEFAULT '20:00',
  quiet_end TEXT NOT NULL DEFAULT '10:00',
  pause_until TEXT,
  stopped_at TEXT,
  schedule_version INTEGER NOT NULL DEFAULT 1,
  next_due_at TEXT,
  prompts_today TEXT,
  prompts_today_count INTEGER NOT NULL DEFAULT 0,
  prompts_week TEXT,
  prompts_week_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  identity_id TEXT,
  source TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  wording_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_occurrences (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  schedule_version INTEGER NOT NULL,
  local_key TEXT NOT NULL,
  status TEXT NOT NULL,
  due_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, local_key)
);

CREATE TABLE IF NOT EXISTS service_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider_blocked INTEGER NOT NULL DEFAULT 0,
  provider_block_reason TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS reminder_due ON reminder_jobs(status, due_at);
CREATE INDEX IF NOT EXISTS outbox_status ON outbox_messages(status);
CREATE INDEX IF NOT EXISTS preferences_due ON messaging_preferences(reminders_enabled, next_due_at);
`;
