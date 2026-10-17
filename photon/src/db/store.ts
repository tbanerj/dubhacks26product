import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import type { MessageRoute, OutboxItem, ProgressSource } from "../messaging/contracts.ts";
import type { SelectedPlace } from "../game/quests.ts";
import { SCHEMA } from "./schema.ts";

export interface IdentityRow {
  id: string;
  player_id: string;
  channel: string;
  project_scope: string;
  sender_id: string;
  opted_out: number;
  linked_app_user: string | null;
  link_failures: number;
  link_failure_window_start: string | null;
  display_name: string;
  timezone: string;
  progress_scope: ProgressSource;
  xp: number;
}

export interface ConversationRow {
  id: string;
  identity_id: string;
  provider_conversation_ref: string;
  serving_line: string | null;
  phase: string;
  area_json: string | null;
  offer_set_id: string | null;
  active_attempt_id: string | null;
  pending_json: string | null;
  version: number;
}

export interface AttemptRow {
  id: string;
  player_id: string;
  quest_id: string;
  quest_version: number;
  offer_set_id: string;
  status: string;
}

export interface SubmissionRow {
  id: string;
  attempt_id: string;
  message_id: string;
  attachment_id: string;
  media_path: string | null;
  content_hash: string | null;
  status: string;
  outcome: string | null;
  outcome_source: string | null;
}

export interface UnlockRow {
  collectible_id: string;
  unlocked_at: string;
}

export type OutboxStatus = "pending" | "sent" | "failed" | "delivery_unknown" | "suppressed";

export class Store {
  constructor(private readonly db: Database) {}

  migrate(): void {
    this.db.exec(SCHEMA);
    const existing = this.db.query("SELECT id FROM schema_migrations WHERE id = 1").get();
    if (!existing) {
      this.db.query("INSERT INTO schema_migrations (id, applied_at) VALUES (1, ?)").run(new Date().toISOString());
    }
  }

  close(): void {
    this.db.close();
  }

  transact<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertInbox(scope: string, channel: string, eventId: string, at: string): boolean {
    try {
      this.db
        .query(
          "INSERT INTO inbox_events (project_scope, channel, event_id, status, created_at) VALUES (?, ?, ?, 'received', ?)",
        )
        .run(scope, channel, eventId, at);
      return true;
    } catch (error) {
      if (isUnique(error)) return false;
      throw error;
    }
  }

  upsertPlayer(input: {
    id: string;
    channel: string;
    projectScope: string;
    senderId: string;
    displayName: string;
    timezone: string;
    progressScope: ProgressSource;
    at: string;
  }): IdentityRow {
    const existing = this.findIdentity(input.channel, input.projectScope, input.senderId);
    if (existing) return existing;
    const playerId = crypto.randomUUID();
    this.db
      .query(
        "INSERT INTO players (id, display_name, locale, timezone, progress_scope, xp, created_at) VALUES (?, ?, 'en', ?, ?, 0, ?)",
      )
      .run(playerId, input.displayName, input.timezone, input.progressScope, input.at);
    this.db
      .query(
        "INSERT INTO messaging_identities (id, player_id, channel, project_scope, sender_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(input.id, playerId, input.channel, input.projectScope, input.senderId, input.at);
    const created = this.findIdentity(input.channel, input.projectScope, input.senderId);
    if (!created) throw new Error("Identity insert failed.");
    return created;
  }

  findIdentity(channel: string, projectScope: string, senderId: string): IdentityRow | undefined {
    return (
      this.db
        .query<IdentityRow, [string, string, string]>(
          `SELECT i.id, i.player_id, i.channel, i.project_scope, i.sender_id, i.opted_out, i.linked_app_user,
                  i.link_failures, i.link_failure_window_start, p.display_name, p.timezone, p.progress_scope, p.xp
           FROM messaging_identities i JOIN players p ON p.id = i.player_id
           WHERE i.channel = ? AND i.project_scope = ? AND i.sender_id = ?`,
        )
        .get(channel, projectScope, senderId) ?? undefined
    );
  }

  findIdentityById(id: string): IdentityRow | undefined {
    return (
      this.db
        .query<IdentityRow, [string]>(
          `SELECT i.id, i.player_id, i.channel, i.project_scope, i.sender_id, i.opted_out, i.linked_app_user,
                  i.link_failures, i.link_failure_window_start, p.display_name, p.timezone, p.progress_scope, p.xp
           FROM messaging_identities i JOIN players p ON p.id = i.player_id WHERE i.id = ?`,
        )
        .get(id) ?? undefined
    );
  }

  setOptOut(identityId: string, optedOut: boolean): void {
    this.db.query("UPDATE messaging_identities SET opted_out = ? WHERE id = ?").run(optedOut ? 1 : 0, identityId);
  }

  ensureConversation(input: {
    identityId: string;
    route: MessageRoute;
    at: string;
  }): ConversationRow {
    const existing = this.db
      .query<ConversationRow, [string, string]>(
        `SELECT id, identity_id, provider_conversation_ref, serving_line, phase, area_json, offer_set_id,
                active_attempt_id, pending_json, version
         FROM conversations WHERE identity_id = ? AND provider_conversation_ref = ?`,
      )
      .get(input.identityId, input.route.providerConversationRef);
    if (existing) {
      if (input.route.servingLine && existing.serving_line !== input.route.servingLine) {
        this.db
          .query("UPDATE conversations SET serving_line = ?, updated_at = ? WHERE id = ?")
          .run(input.route.servingLine, input.at, existing.id);
        existing.serving_line = input.route.servingLine;
      }
      return existing;
    }
    const id = crypto.randomUUID();
    this.db
      .query(
        `INSERT INTO conversations (
           id, identity_id, provider_conversation_ref, serving_line, phase, version, updated_at
         ) VALUES (?, ?, ?, ?, 'NEW', 0, ?)`,
      )
      .run(id, input.identityId, input.route.providerConversationRef, input.route.servingLine ?? null, input.at);
    return this.conversationById(id)!;
  }

  conversationById(id: string): ConversationRow | undefined {
    return (
      this.db
        .query<ConversationRow, [string]>(
          `SELECT id, identity_id, provider_conversation_ref, serving_line, phase, area_json, offer_set_id,
                  active_attempt_id, pending_json, version
           FROM conversations WHERE id = ?`,
        )
        .get(id) ?? undefined
    );
  }

  saveConversation(row: ConversationRow, at: string): void {
    this.db
      .query(
        `UPDATE conversations
         SET phase = ?, area_json = ?, offer_set_id = ?, active_attempt_id = ?, pending_json = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
      )
      .run(row.phase, row.area_json, row.offer_set_id, row.active_attempt_id, row.pending_json, at, row.id);
  }

  insertOffer(input: { playerId: string; conversationId: string; optionsJson: string; at: string }): string {
    const id = crypto.randomUUID();
    this.db
      .query(
        "INSERT INTO quest_offer_sets (id, player_id, conversation_id, options_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, input.playerId, input.conversationId, input.optionsJson, input.at);
    return id;
  }

  offerOptions(id: string): string | undefined {
    const row = this.db.query<{ options_json: string }, [string]>("SELECT options_json FROM quest_offer_sets WHERE id = ?").get(id);
    return row?.options_json;
  }

  insertAttempt(input: {
    playerId: string;
    conversationId: string;
    questId: string;
    questVersion: number;
    offerSetId: string;
    at: string;
  }): string {
    const id = crypto.randomUUID();
    this.db
      .query(
        `INSERT INTO quest_attempts (
           id, player_id, conversation_id, quest_id, quest_version, offer_set_id, status, started_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      )
      .run(id, input.playerId, input.conversationId, input.questId, input.questVersion, input.offerSetId, input.at);
    return id;
  }

  conversationByAttempt(attemptId: string): ConversationRow | undefined {
    return (
      this.db
        .query<ConversationRow, [string]>(
          `SELECT c.id, c.identity_id, c.provider_conversation_ref, c.serving_line, c.phase, c.area_json,
                  c.offer_set_id, c.active_attempt_id, c.pending_json, c.version
           FROM conversations c
           JOIN quest_attempts a ON a.conversation_id = c.id
           WHERE a.id = ?`,
        )
        .get(attemptId) ?? undefined
    );
  }

  attempt(id: string): AttemptRow | undefined {
    return (
      this.db
        .query<AttemptRow, [string]>(
          "SELECT id, player_id, quest_id, quest_version, offer_set_id, status FROM quest_attempts WHERE id = ?",
        )
        .get(id) ?? undefined
    );
  }

  setAttemptStatus(id: string, status: string, at: string): void {
    const column = status === "cancelled" ? "cancelled_at" : status === "completed" ? "completed_at" : null;
    if (column) {
      this.db.query(`UPDATE quest_attempts SET status = ?, ${column} = ? WHERE id = ?`).run(status, at, id);
    } else {
      this.db.query("UPDATE quest_attempts SET status = ? WHERE id = ?").run(status, id);
    }
  }

  hasQuestReward(playerId: string, questId: string): boolean {
    const row = this.db
      .query<{ id: string }, [string, string]>("SELECT id FROM reward_ledger WHERE player_id = ? AND quest_id = ?")
      .get(playerId, questId);
    return Boolean(row);
  }

  insertSubmission(input: {
    attemptId: string;
    messageId: string;
    attachmentId: string;
    mediaPath: string;
    contentHash: string;
    at: string;
  }): string | undefined {
    const id = crypto.randomUUID();
    try {
      this.db
        .query(
          `INSERT INTO evidence_submissions (
             id, attempt_id, message_id, attachment_id, media_path, content_hash, status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'verifying', ?)`,
        )
        .run(id, input.attemptId, input.messageId, input.attachmentId, input.mediaPath, input.contentHash, input.at);
      return id;
    } catch (error) {
      if (isUnique(error)) return undefined;
      throw error;
    }
  }

  submission(id: string): SubmissionRow | undefined {
    return (
      this.db
        .query<SubmissionRow, [string]>(
          `SELECT id, attempt_id, message_id, attachment_id, media_path, content_hash, status, outcome, outcome_source
           FROM evidence_submissions WHERE id = ?`,
        )
        .get(id) ?? undefined
    );
  }

  finishSubmission(id: string, status: string, outcome: string | null, source: string | null, explanation: string | null): void {
    this.db
      .query(
        "UPDATE evidence_submissions SET status = ?, outcome = ?, outcome_source = ?, explanation = ? WHERE id = ?",
      )
      .run(status, outcome, source, explanation, id);
  }

  insertReward(input: {
    playerId: string;
    attemptId: string;
    questId: string;
    xpDelta: number;
    collectibleId: string;
    source: ProgressSource;
    operationKey: string;
    at: string;
  }): boolean {
    const id = crypto.randomUUID();
    try {
      this.db
        .query(
          `INSERT INTO reward_ledger (
             id, player_id, attempt_id, quest_id, xp_delta, collectible_id, source, operation_key, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.playerId,
          input.attemptId,
          input.questId,
          input.xpDelta,
          input.collectibleId,
          input.source,
          input.operationKey,
          input.at,
        );
    } catch (error) {
      if (isUnique(error)) return false;
      throw error;
    }
    this.db.query("UPDATE players SET xp = xp + ? WHERE id = ?").run(input.xpDelta, input.playerId);
    this.db
      .query(
        "INSERT OR IGNORE INTO collectible_unlocks (player_id, collectible_id, reward_id, unlocked_at) VALUES (?, ?, ?, ?)",
      )
      .run(input.playerId, input.collectibleId, id, input.at);
    return true;
  }

  playerXp(playerId: string): number {
    return this.db.query<{ xp: number }, [string]>("SELECT xp FROM players WHERE id = ?").get(playerId)?.xp ?? 0;
  }

  unlocks(playerId: string): UnlockRow[] {
    return this.db
      .query<UnlockRow, [string]>(
        "SELECT collectible_id, unlocked_at FROM collectible_unlocks WHERE player_id = ? ORDER BY unlocked_at ASC",
      )
      .all(playerId);
  }

  enqueue(input: { operationKey: string; conversationId: string; route: MessageRoute; text: string; at: string }): boolean {
    try {
      this.db
        .query(
          `INSERT INTO outbox_messages (operation_key, conversation_id, route_json, body, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', ?)`,
        )
        .run(input.operationKey, input.conversationId, JSON.stringify(input.route), input.text, input.at);
      return true;
    } catch (error) {
      if (isUnique(error)) return false;
      throw error;
    }
  }

  pendingOutbox(): Array<OutboxItem & { attempts: number }> {
    const rows = this.db
      .query<{ operation_key: string; conversation_id: string; route_json: string; body: string; attempts: number }, []>(
        `SELECT operation_key, conversation_id, route_json, body, attempts
         FROM outbox_messages WHERE status IN ('pending', 'delivery_unknown') ORDER BY created_at ASC`,
      )
      .all();
    return rows.map((row) => ({
      operationKey: row.operation_key,
      conversationId: row.conversation_id,
      text: row.body,
      route: JSON.parse(row.route_json) as MessageRoute,
      attempts: row.attempts,
    }));
  }

  optedOutConversation(conversationId: string): boolean {
    const row = this.db
      .query<{ opted_out: number }, [string]>(
        `SELECT i.opted_out FROM conversations c
         JOIN messaging_identities i ON i.id = c.identity_id WHERE c.id = ?`,
      )
      .get(conversationId);
    return row?.opted_out === 1;
  }

  markOutbox(operationKey: string, status: OutboxStatus, providerMessageId?: string, errorCategory?: string): void {
    this.db
      .query(
        `UPDATE outbox_messages
         SET status = ?, attempts = attempts + 1, provider_message_id = COALESCE(?, provider_message_id), error_category = ?
         WHERE operation_key = ?`,
      )
      .run(status, providerMessageId ?? null, errorCategory ?? null, operationKey);
  }

  suppressPending(conversationId: string): void {
    this.db
      .query("UPDATE outbox_messages SET status = 'suppressed' WHERE conversation_id = ? AND status IN ('pending', 'delivery_unknown')")
      .run(conversationId);
  }

  insertReminder(input: { playerId: string; attemptId: string; conversationId: string; dueAt: string; at: string }): string {
    this.db
      .query("UPDATE reminder_jobs SET status = 'cancelled' WHERE attempt_id = ? AND status = 'pending'")
      .run(input.attemptId);
    const id = crypto.randomUUID();
    this.db
      .query(
        `INSERT INTO reminder_jobs (id, player_id, attempt_id, conversation_id, due_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(id, input.playerId, input.attemptId, input.conversationId, input.dueAt, input.at);
    return id;
  }

  cancelRemindersForPlayer(playerId: string): void {
    this.db.query("UPDATE reminder_jobs SET status = 'cancelled' WHERE player_id = ? AND status = 'pending'").run(playerId);
  }

  cancelRemindersForAttempt(attemptId: string): void {
    this.db.query("UPDATE reminder_jobs SET status = 'cancelled' WHERE attempt_id = ? AND status = 'pending'").run(attemptId);
  }

  dueReminders(nowIso: string): Array<{ id: string; attempt_id: string; conversation_id: string; due_at: string }> {
    return this.db
      .query<{ id: string; attempt_id: string; conversation_id: string; due_at: string }, [string]>(
        `SELECT id, attempt_id, conversation_id, due_at FROM reminder_jobs
         WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC`,
      )
      .all(nowIso);
  }

  markReminder(id: string, status: string): void {
    this.db.query("UPDATE reminder_jobs SET status = ? WHERE id = ?").run(status, id);
  }

  insertLinkToken(input: { tokenHash: string; appUserId: string; expiresAt: string; at: string }): string {
    const id = crypto.randomUUID();
    this.db
      .query(
        `INSERT INTO link_tokens (id, token_hash, app_user_id, expires_at, state, created_at)
         VALUES (?, ?, ?, ?, 'issued', ?)`,
      )
      .run(id, input.tokenHash, input.appUserId, input.expiresAt, input.at);
    return id;
  }

  linkByHash(tokenHash: string):
    | { id: string; app_user_id: string; messaging_identity_id: string | null; expires_at: string; state: string }
    | undefined {
    return (
      this.db
        .query<
          { id: string; app_user_id: string; messaging_identity_id: string | null; expires_at: string; state: string },
          [string]
        >("SELECT id, app_user_id, messaging_identity_id, expires_at, state FROM link_tokens WHERE token_hash = ?")
        .get(tokenHash) ?? undefined
    );
  }

  pendingLinkForUser(appUserId: string):
    | { id: string; messaging_identity_id: string | null; expires_at: string; state: string }
    | undefined {
    return (
      this.db
        .query<{ id: string; messaging_identity_id: string | null; expires_at: string; state: string }, [string]>(
          `SELECT id, messaging_identity_id, expires_at, state FROM link_tokens
           WHERE app_user_id = ? AND state IN ('issued', 'pending') ORDER BY created_at DESC LIMIT 1`,
        )
        .get(appUserId) ?? undefined
    );
  }

  setLinkPending(id: string, identityId: string): void {
    this.db.query("UPDATE link_tokens SET state = 'pending', messaging_identity_id = ? WHERE id = ?").run(identityId, id);
  }

  setLinkState(id: string, state: string): void {
    this.db.query("UPDATE link_tokens SET state = ? WHERE id = ?").run(state, id);
  }

  recordLinkFailure(identityId: string, nowIso: string, windowMs: number): number {
    const row = this.findIdentityById(identityId);
    if (!row) return 0;
    const windowStart = row.link_failure_window_start ? Date.parse(row.link_failure_window_start) : 0;
    const fresh = !windowStart || Date.parse(nowIso) - windowStart > windowMs;
    const failures = fresh ? 1 : row.link_failures + 1;
    const start = fresh ? nowIso : row.link_failure_window_start;
    this.db
      .query("UPDATE messaging_identities SET link_failures = ?, link_failure_window_start = ? WHERE id = ?")
      .run(failures, start, identityId);
    return failures;
  }

  linkFailureCount(identityId: string, nowIso: string, windowMs: number): number {
    const row = this.findIdentityById(identityId);
    if (!row?.link_failure_window_start) return 0;
    if (Date.parse(nowIso) - Date.parse(row.link_failure_window_start) > windowMs) return 0;
    return row.link_failures;
  }

  linkIdentity(identityId: string, appUserId: string): void {
    this.db.query("UPDATE messaging_identities SET linked_app_user = ?, link_failures = 0 WHERE id = ?").run(appUserId, identityId);
  }

  unlinkAppUser(appUserId: string): void {
    this.db.query("UPDATE messaging_identities SET linked_app_user = NULL WHERE linked_app_user = ?").run(appUserId);
    this.db
      .query("UPDATE link_tokens SET state = 'revoked' WHERE app_user_id = ? AND state IN ('issued', 'pending', 'redeemed')")
      .run(appUserId);
  }

  identityForAppUser(appUserId: string): IdentityRow | undefined {
    return (
      this.db
        .query<IdentityRow, [string]>(
          `SELECT i.id, i.player_id, i.channel, i.project_scope, i.sender_id, i.opted_out, i.linked_app_user,
                  i.link_failures, i.link_failure_window_start, p.display_name, p.timezone, p.progress_scope, p.xp
           FROM messaging_identities i JOIN players p ON p.id = i.player_id WHERE i.linked_app_user = ?`,
        )
        .get(appUserId) ?? undefined
    );
  }

  activeAttemptForPlayer(playerId: string): AttemptRow | undefined {
    return (
      this.db
        .query<AttemptRow, [string]>(
          `SELECT id, player_id, quest_id, quest_version, offer_set_id, status FROM quest_attempts
           WHERE player_id = ? AND status IN ('active', 'verifying') ORDER BY started_at DESC LIMIT 1`,
        )
        .get(playerId) ?? undefined
    );
  }

  expiredMedia(cutoffIso: string): Array<{ id: string; media_path: string }> {
    return this.db
      .query<{ id: string; media_path: string }, [string]>(
        "SELECT id, media_path FROM evidence_submissions WHERE media_path IS NOT NULL AND created_at <= ?",
      )
      .all(cutoffIso);
  }

  clearMediaPath(id: string): void {
    this.db.query("UPDATE evidence_submissions SET media_path = NULL WHERE id = ?").run(id);
  }

  referencedMediaPaths(): Set<string> {
    const rows = this.db.query<{ media_path: string }, []>("SELECT media_path FROM evidence_submissions WHERE media_path IS NOT NULL").all();
    return new Set(rows.map((row) => row.media_path));
  }

  resetDemo(): number {
    const result = this.db.query("DELETE FROM players WHERE progress_scope = 'demo'").run();
    this.db.query("DELETE FROM inbox_events WHERE project_scope = 'demo' OR channel = 'demo'").run();
    return result.changes;
  }
}

export function openStore(databasePath: string): Store {
  mkdirSync(databasePath.includes("/") ? databasePath.slice(0, databasePath.lastIndexOf("/")) : ".", { recursive: true });
  const db = new Database(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const store = new Store(db);
  store.migrate();
  return store;
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE");
}

export function parsePlace(json: string | null): SelectedPlace | undefined {
  if (!json) return undefined;
  const value = JSON.parse(json) as SelectedPlace;
  if (!value.label) return undefined;
  return value;
}
