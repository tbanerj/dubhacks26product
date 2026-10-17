import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig, type Config } from "../config.ts";
import { openStore, type Store } from "../db/store.ts";
import { confirmLink, issueLinkCode, progressForLinkedUser } from "./linking.ts";
import { stageIncoming, settleSubmission, deliverDueReminders, type Runtime } from "./engine.ts";
import { tinyPng } from "./images.ts";
import { cleanupExpiredMedia } from "../jobs/retention.ts";
import type { IncomingMessage } from "../messaging/contracts.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("thaw conversation", () => {
  test("first message creates a player and asks for a place", () => {
    const runtime = makeRuntime();
    const result = stageIncoming(runtime, text("ada", "hello"));
    expect(result.duplicate).toBe(false);
    expect(result.replies[0]?.text).toContain("What city, neighborhood, or public landmark");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.display_name).toBe("adventurer");
  });

  test("two players stay independent", () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "Capitol Hill"));
    stageIncoming(runtime, text("ada", "1"));
    stageIncoming(runtime, text("ben", "hello"));
    const ada = runtime.store.findIdentity("demo", "demo", "ada");
    const ben = runtime.store.findIdentity("demo", "demo", "ben");
    expect(ada?.player_id).not.toBe(ben?.player_id);
    expect(runtime.store.activeAttemptForPlayer(ada!.player_id)?.quest_id).toBe("hidden-detail");
    expect(runtime.store.activeAttemptForPlayer(ben!.player_id)).toBeUndefined();
  });

  test("ambiguous place asks which one and stores no coordinates", () => {
    const runtime = makeRuntime();
    const asked = stageIncoming(runtime, text("ada", "Springfield"));
    expect(asked.replies[0]?.text).toContain("more than one demo place");
    const identity = runtime.store.findIdentity("demo", "demo", "ada")!;
    const conversation = runtime.store.ensureConversation({
      identityId: identity.id,
      route: { providerConversationRef: "conv-ada" },
      at: now,
    });
    expect(conversation.area_json).toBeNull();
    const chosen = stageIncoming(runtime, text("ada", "2"));
    expect(chosen.replies[0]?.text).toContain("Springfield public library");
    expect(chosen.replies[0]?.text).not.toContain("latitude");
  });

  test("an invalid quest number keeps the same offer", () => {
    const runtime = makeRuntime();
    reachMenu(runtime, "ada");
    const before = stageIncoming(runtime, text("ada", "9"));
    expect(before.replies[0]?.text).toContain("1 to 3");
    const chosen = stageIncoming(runtime, text("ada", "2"));
    expect(chosen.replies[0]?.text).toContain("Nature Nearby");
  });

  test("the same menu number selects the same quest after a restart", () => {
    const runtime = makeRuntime();
    reachMenu(runtime, "ada");
    runtime.store.close();
    const restarted = reopen(runtime);
    const chosen = stageIncoming(restarted, text("ada", "2"));
    expect(chosen.replies[0]?.text).toContain("Nature Nearby");
    restarted.store.close();
  });

  test("a photo before a quest does not award XP", () => {
    const runtime = makeRuntime();
    const result = stageIncoming(runtime, photo("ada"));
    expect(result.submissionId).toBeUndefined();
    expect(result.replies[0]?.text).toContain("don't have an active quest");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
  });

  test("a valid photo is acknowledged once and then rewarded once", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    expect(staged.replies.map((item) => item.text).join("\n")).toContain("Got your photo");
    expect(staged.submissionId).toBeTruthy();
    const settled = settleSubmission(runtime, staged.submissionId!, "success");
    expect(settled[0]?.text.startsWith("Demo verification.")).toBe(true);
    expect(settled[0]?.text).toContain("40 XP");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
    const again = settleSubmission(runtime, staged.submissionId!, "success");
    expect(again).toHaveLength(0);
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
  });

  test("duplicate provider events do not reply twice", () => {
    const runtime = makeRuntime();
    const first = text("ada", "hello");
    stageIncoming(runtime, first);
    const second = stageIncoming(runtime, first);
    expect(second.duplicate).toBe(true);
    expect(second.replies).toHaveLength(0);
  });

  test("a mismatched photo leaves the quest active", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    const settled = settleSubmission(runtime, staged.submissionId!, "mismatch");
    expect(settled[0]?.text).toContain("still active");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
    const status = stageIncoming(runtime, text("ada", "STATUS"));
    expect(status.replies[0]?.text).toContain("Hidden Detail");
  });

  test("an unavailable verifier keeps the submission and awards nothing", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    const settled = settleSubmission(runtime, staged.submissionId!, "unavailable");
    expect(settled[0]?.text).toContain("unavailable");
    expect(settled[0]?.text).toContain("saved");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
  });

  test("a second attempt of the same quest does not pay again", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    settleSubmission(runtime, staged.submissionId!, "success");
    const menu = stageIncoming(runtime, text("ada", "QUEST"));
    expect(menu.replies[0]?.text).toContain("Hidden Detail");
    const repeat = stageIncoming(runtime, text("ada", "1"));
    expect(repeat.replies[0]?.text).toContain("already earned");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
  });

  test("cancel during verification blocks the late result", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    stageIncoming(runtime, text("ada", "CANCEL"));
    const settled = settleSubmission(runtime, staged.submissionId!, "success");
    expect(settled).toHaveLength(0);
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
  });

  test("STOP suppresses a later result and a reminder", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    stageIncoming(runtime, text("ada", "REMIND 15"));
    const staged = stageIncoming(runtime, photo("ada"));
    const stopped = stageIncoming(runtime, text("ada", "STOP"));
    expect(stopped.replies[0]?.text).toContain("paused");
    const settled = settleSubmission(runtime, staged.submissionId!, "success");
    expect(settled).toHaveLength(0);
    runtime.clock.current = new Date(Date.parse(now) + 16 * 60 * 1000);
    expect(deliverDueReminders(runtime)).toHaveLength(0);
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
  });

  test("a reward survives when the reply has not been marked sent", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    settleSubmission(runtime, staged.submissionId!, "success");
    const pending = runtime.store.pendingOutbox().filter((item) => item.text.includes("Quest complete"));
    expect(pending).toHaveLength(1);
    runtime.store.close();
    const restarted = reopen(runtime);
    expect(restarted.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
    expect(restarted.store.pendingOutbox().filter((item) => item.text.includes("Quest complete"))).toHaveLength(1);
    restarted.store.close();
  });

  test("one requested reminder is delivered once", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const set = stageIncoming(runtime, text("ada", "REMIND 15"));
    expect(set.replies[0]?.text).toContain("15 minutes");
    runtime.clock.current = new Date(Date.parse(now) + 16 * 60 * 1000);
    const due = deliverDueReminders(runtime);
    expect(due).toHaveLength(1);
    expect(due[0]?.text).toContain("Hidden Detail");
    expect(deliverDueReminders(runtime)).toHaveLength(0);
  });

  test("a stale reminder expires instead of sending", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    stageIncoming(runtime, text("ada", "REMIND 15"));
    runtime.clock.current = new Date(Date.parse(now) + 7 * 60 * 60 * 1000);
    expect(deliverDueReminders(runtime)).toHaveLength(0);
  });

  test("HEIC and oversized images do not end the quest", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const heic = stageIncoming(runtime, photo("ada", Buffer.from("0000ftypheic0000")));
    expect(heic.replies[0]?.text).toContain("HEIC");
    expect(heic.submissionId).toBeUndefined();
    const huge = new Uint8Array(32);
    huge.set([0x89, 0x50, 0x4e, 0x47]);
    const rejected = stageIncoming(runtime, photo("ada", huge, { declaredSizeBytes: runtime.config.maxImageBytes + 1, rejected: "too_large" }));
    expect(rejected.replies[0]?.text.toLowerCase()).toContain("limit");
    const status = stageIncoming(runtime, text("ada", "STATUS"));
    expect(status.replies[0]?.text).toContain("Hidden Detail");
  });

  test("only the first readable image in a batch is accepted", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(
      runtime,
      photo("ada", tinyPng(), { extra: tinyPng() }),
    );
    expect(staged.replies.map((item) => item.text).join("\n")).toContain("first photo");
    settleSubmission(runtime, staged.submissionId!, "success");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
  });

  test("link codes expire, rate limit, and preserve progress once confirmed", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    settleSubmission(runtime, staged.submissionId!, "success");
    const issued = issueLinkCode(runtime, "judge");
    const redeemed = stageIncoming(runtime, text("ada", `LINK ${issued.code}`));
    expect(redeemed.replies[0]?.text).toContain("confirm");
    const confirmed = confirmLink(runtime, "judge");
    expect(confirmed.ok).toBe(true);
    const progress = progressForLinkedUser(runtime, "judge");
    expect(progress.linked).toBe(true);
    if (progress.linked) expect(progress.xp).toBe(40);
    const reused = stageIncoming(runtime, text("ada", `LINK ${issued.code}`));
    expect(reused.replies[0]?.text).toContain("didn't work");

    const fresh = issueLinkCode(runtime, "other");
    runtime.clock.current = new Date(Date.parse(now) + 11 * 60 * 1000);
    const expired = stageIncoming(runtime, text("ben", `LINK ${fresh.code}`));
    expect(expired.replies[0]?.text).toContain("didn't work");
    for (let attempt = 0; attempt < 4; attempt += 1) stageIncoming(runtime, text("ben", "LINK AAAAAAAA"));
    const limited = stageIncoming(runtime, text("ben", "LINK BBBBBBBB"));
    expect(limited.replies[0]?.text.toLowerCase()).toContain("too many");
  });

  test("expired media is removed without deleting the reward", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    settleSubmission(runtime, staged.submissionId!, "success");
    runtime.clock.current = new Date(Date.parse(now) + 25 * 60 * 60 * 1000);
    const removed = cleanupExpiredMedia(runtime);
    expect(removed).toBeGreaterThan(0);
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(40);
    const status = stageIncoming(runtime, text("ada", "COLLECTION"));
    expect(status.replies[0]?.text).toContain("Hidden Detail pin");
  });
});

describe("configuration", () => {
  test("live verification fails closed", () => {
    expect(() => loadConfig({ THAW_VERIFIER: "live", THAW_TRANSPORT: "demo" })).toThrow(/not available/);
  });
});

const now = "2026-10-17T19:00:00.000Z";

function makeRuntime(): Runtime & { clock: { current: Date }; dir: string; config: Config } {
  const dir = mkdtempSync(join(tmpdir(), "thaw-"));
  dirs.push(dir);
  const config = loadConfig({
    THAW_TRANSPORT: "demo",
    THAW_VERIFIER: "demo",
    THAW_DATABASE_PATH: join(dir, "thaw.sqlite"),
    THAW_MEDIA_DIR: join(dir, "media"),
    THAW_DEV_API: "0",
    THAW_DEFAULT_TIMEZONE: "UTC",
  });
  const store = openStore(config.databasePath);
  const clock = { current: new Date(now) };
  return { config, store, now: () => clock.current, clock, dir };
}

function reopen(previous: Runtime & { dir: string }): Runtime & { clock: { current: Date }; dir: string } {
  const store: Store = openStore(previous.config.databasePath);
  return { config: previous.config, store, now: previous.now, clock: { current: previous.now() }, dir: previous.dir };
}

function text(sender: string, body: string, id = crypto.randomUUID()): IncomingMessage {
  return {
    channel: "demo",
    projectScope: "demo",
    messageId: id,
    senderId: sender,
    receivedAt: now,
    text: body,
    attachments: [],
    route: { providerConversationRef: `conv-${sender}` },
  };
}

function photo(
  sender: string,
  bytes: Uint8Array = tinyPng(),
  extra?: { declaredSizeBytes?: number; rejected?: "too_large"; extra?: Uint8Array },
): IncomingMessage {
  const attachments: IncomingMessage["attachments"] = [
    {
      attachmentId: crypto.randomUUID(),
      bytes: extra?.rejected ? undefined : bytes,
      declaredSizeBytes: extra?.declaredSizeBytes,
      rejected: extra?.rejected,
      declaredMimeType: "image/png",
    },
  ];
  if (extra?.extra) {
    attachments.push({ attachmentId: crypto.randomUUID(), bytes: extra.extra, declaredMimeType: "image/png" });
  }
  return { ...text(sender, ""), attachments };
}

function reachMenu(runtime: Runtime, sender: string): void {
  stageIncoming(runtime, text(sender, "Capitol Hill"));
}

function acceptFirst(runtime: Runtime, sender: string): void {
  reachMenu(runtime, sender);
  stageIncoming(runtime, text(sender, "1"));
}
