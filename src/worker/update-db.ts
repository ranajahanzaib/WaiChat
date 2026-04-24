/**
 * Database helpers for the auto-update system.
 * Operates on the `update_state` and `update_log` tables.
 */
import type { UpdateChannel } from "./manifest";

export interface UpdateState {
  channel: UpdateChannel;
  current_version: string;
  latest_version: string | null;
  last_check: string;
  last_attempt: string | null;
  last_status: "up_to_date" | "available" | "queued" | "success" | "failed";
  last_error: string | null;
}

export interface UpdateLogEntry {
  id: number;
  version: string | null;
  attempted_at: string;
  status: string;
  error_message: string | null;
  files_updated: number | null;
  duration_ms: number | null;
}

/** Read the update state for a specific channel. */
export async function getUpdateState(
  db: D1Database,
  channel: UpdateChannel,
): Promise<UpdateState | null> {
  const result = await db
    .prepare("SELECT * FROM update_state WHERE channel = ?")
    .bind(channel)
    .first<UpdateState>();
  return result || null;
}

/** Update state after a version check (cron or manual). */
export async function updateCheckStatus(
  db: D1Database,
  channel: UpdateChannel,
  update: {
    last_check: string;
    last_status: string;
    latest_version?: string | null;
    last_error?: string | null;
  },
) {
  await db
    .prepare(
      `UPDATE update_state
       SET last_check = ?, last_status = ?, latest_version = ?, last_error = ?
       WHERE channel = ?`,
    )
    .bind(
      update.last_check,
      update.last_status,
      update.latest_version ?? null,
      update.last_error ?? null,
      channel,
    )
    .run();
}

/** Update state + log after a successful commit. */
export async function updateAfterCommit(
  db: D1Database,
  channel: UpdateChannel,
  log: {
    version: string;
    status: string;
    files_updated: number;
    duration_ms: number;
  },
) {
  const now = new Date().toISOString();

  // Update main state
  await db
    .prepare(
      `UPDATE update_state
       SET current_version = ?, latest_version = ?, last_status = 'success', last_error = NULL, last_attempt = ?
       WHERE channel = ?`,
    )
    .bind(log.version, log.version, now, channel)
    .run();

  // Log the event
  await logUpdateAttempt(db, {
    version: log.version,
    attempted_at: now,
    status: "commit_success",
    files_updated: log.files_updated,
    duration_ms: log.duration_ms,
  });
}

/** Insert a row into the update_log audit table. */
export async function logUpdateAttempt(
  db: D1Database,
  log: {
    version: string;
    attempted_at: string;
    status: string;
    error_message?: string | null;
    files_updated?: number | null;
    duration_ms?: number | null;
  },
) {
  await db
    .prepare(
      `INSERT INTO update_log
       (version, attempted_at, status, error_message, files_updated, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      log.version,
      log.attempted_at,
      log.status,
      log.error_message ?? null,
      log.files_updated ?? null,
      log.duration_ms ?? null,
    )
    .run();
}

/** Fetch recent update log entries for UI display. */
export async function getUpdateLog(db: D1Database, limit = 10): Promise<UpdateLogEntry[]> {
  const results = await db
    .prepare(
      `SELECT id, version, attempted_at, status, error_message, files_updated, duration_ms
       FROM update_log
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<UpdateLogEntry>();
  return results.results || [];
}
