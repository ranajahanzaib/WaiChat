-- Restructure update_state to support per-channel tracking
DROP TABLE IF EXISTS update_state;

CREATE TABLE update_state (
  channel TEXT PRIMARY KEY, -- 'stable' or 'pre-release'
  current_version TEXT NOT NULL,
  latest_version TEXT,
  last_check TEXT NOT NULL,
  last_attempt TEXT,
  last_status TEXT NOT NULL DEFAULT 'up_to_date',
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed both channels with the current version
INSERT INTO update_state (channel, current_version, last_check, last_status)
VALUES ('stable', 'v0.1.4-alpha', datetime('now'), 'up_to_date');

INSERT INTO update_state (channel, current_version, last_check, last_status)
VALUES ('pre-release', 'v0.1.4-alpha', datetime('now'), 'up_to_date');
