-- Auto-update system: tracks current version and update history
CREATE TABLE IF NOT EXISTS update_state (
  id INTEGER PRIMARY KEY,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  last_check TEXT NOT NULL,
  last_attempt TEXT,
  last_status TEXT NOT NULL DEFAULT 'up_to_date',
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed with the current version
INSERT INTO update_state (id, current_version, last_check, last_status)
VALUES (1, 'v0.1.0', datetime('now'), 'up_to_date');

-- Historical log of all update attempts (audit trail)
CREATE TABLE IF NOT EXISTS update_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  files_updated INTEGER,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
