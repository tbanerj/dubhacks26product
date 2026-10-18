import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig, type Config } from "../config.ts";
import { openStore, type Store } from "../db/store.ts";
import { confirmLink, issueLinkCode, progressForLinkedUser } from "./linking.ts";
import { stageIncoming, settleSubmission, settleLive, deliverDueReminders, type Runtime } from "./engine.ts";
import { deliverOutbox } from "../messaging/deliver.ts";
import { runScheduler } from "../messaging/scheduler.ts";
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
    expect(settled[0]?.text).toContain("60 XP");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
    const again = settleSubmission(runtime, staged.submissionId!, "success");
    expect(again).toHaveLength(0);
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
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
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
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
    expect(restarted.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
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
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
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
    if (progress.linked) expect(progress.xp).toBe(60);
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
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(60);
    const status = stageIncoming(runtime, text("ada", "COLLECTION"));
    expect(status.replies[0]?.text).toContain("Hidden Detail pin");
  });

  test("a crash after the inbox insert can still be processed", () => {
    const runtime = makeRuntime();
    const message = text("ada", "hello");
    expect(runtime.store.claimInbox(message.projectScope, message.channel, message.messageId, message.receivedAt)).toBe("new");
    const recovered = stageIncoming(runtime, message);
    expect(recovered.duplicate).toBe(false);
    expect(recovered.replies[0]?.text).toContain("public landmark");
    const again = stageIncoming(runtime, message);
    expect(again.duplicate).toBe(true);
  });

  test("STOP then RESUME does not turn reminders back on", () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "hello"));
    stageIncoming(runtime, text("ada", "REMINDERS ON"));
    const stopped = stageIncoming(runtime, text("ada", "stop texting me"));
    expect(stopped.replies[0]?.text.toLowerCase()).toContain("paused");
    const resume = stageIncoming(runtime, text("ada", "RESUME"));
    expect(resume.replies[0]?.text).toContain("does not undo STOP");
    const started = stageIncoming(runtime, text("ada", "START"));
    expect(started.replies[0]?.text).toContain("Welcome back");
    const identity = runtime.store.findIdentity("demo", "demo", "ada")!;
    expect(runtime.store.preferences(identity.player_id)?.reminders_enabled).toBe(0);
    const status = stageIncoming(runtime, text("ada", "STATUS"));
    expect(status.replies[0]?.text).toContain("XP");
  });

  test("PAUSE holds prompts and RESUME clears only the pause", () => {
    const runtime = makeRuntime();
    runtime.config.proactiveEnabled = true;
    stageIncoming(runtime, text("ada", "hello"));
    stageIncoming(runtime, text("ada", "REMINDERS ON"));
    const paused = stageIncoming(runtime, text("ada", "PAUSE 3 DAYS"));
    expect(paused.replies[0]?.text).toContain("paused until");
    const identity = runtime.store.findIdentity("demo", "demo", "ada")!;
    const until = runtime.store.preferences(identity.player_id)?.pause_until;
    expect(until).toBeTruthy();
    expect(Date.parse(until!) - Date.parse(now)).toBeGreaterThan(2 * 86_400_000);
    const resumed = stageIncoming(runtime, text("ada", "RESUME"));
    expect(resumed.replies[0]?.text).toContain("Pause cleared");
    expect(runtime.store.preferences(identity.player_id)?.pause_until).toBeNull();
    expect(runtime.store.preferences(identity.player_id)?.reminders_enabled).toBe(1);
  });

  test("a live verifier outage does not award XP", async () => {
    const runtime = makeRuntime();
    runtime.config.verifier = "live";
    runtime.verifyPhoto = async () => ({ kind: "temporary_error", feedback: "Gemini is down." });
    acceptFirst(runtime, "ada");
    const staged = stageIncoming(runtime, photo("ada"));
    const settled = await settleLive(runtime, staged.submissionId!);
    expect(settled[0]?.text).toContain("still active");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
    const status = stageIncoming(runtime, text("ada", "STATUS"));
    expect(status.replies[0]?.text).toContain("Hidden Detail");
  });

  test("an unsupported image never calls the verifier", async () => {
    const runtime = makeRuntime();
    let calls = 0;
    runtime.verifyPhoto = async () => {
      calls += 1;
      return { kind: "accepted", feedback: "nope" };
    };
    acceptFirst(runtime, "ada");
    const heic = stageIncoming(runtime, photo("ada", Buffer.from("0000ftypheic0000")));
    expect(heic.submissionId).toBeUndefined();
    expect(calls).toBe(0);
  });

  test("two players do not share photos", () => {
    const runtime = makeRuntime();
    acceptFirst(runtime, "ada");
    acceptFirst(runtime, "ben");
    const ada = stageIncoming(runtime, photo("ada"));
    const ben = stageIncoming(runtime, photo("ben"));
    const adaPath = runtime.store.submission(ada.submissionId!)?.media_path;
    const benPath = runtime.store.submission(ben.submissionId!)?.media_path;
    expect(adaPath).toBeTruthy();
    expect(benPath).toBeTruthy();
    expect(adaPath).not.toBe(benPath);
  });

  test("a link cannot attach a chat that another account already owns", () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "hello"));
    const first = issueLinkCode(runtime, "account-a");
    stageIncoming(runtime, text("ada", `LINK ${first.code}`));
    expect(confirmLink(runtime, "account-a").ok).toBe(true);
    const second = issueLinkCode(runtime, "account-b");
    stageIncoming(runtime, text("ada", `LINK ${second.code}`));
    const conflict = confirmLink(runtime, "account-b");
    expect(conflict.ok).toBe(false);
    expect(runtime.store.identityForAppUser("account-a")).toBeTruthy();
    expect(runtime.store.identityForAppUser("account-b")).toBeUndefined();
  });

  test("an unregistered recipient is a permanent send failure", async () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "hello"));
    const pending = runtime.store.pendingOutbox();
    expect(pending.length).toBeGreaterThan(0);
    await deliverOutbox(runtime, async () => {
      throw new Error("Target not allowed for this project");
    });
    expect(runtime.store.providerBlocked()).toBe(true);
    expect(runtime.store.pendingOutbox()).toHaveLength(0);
  });

  test("a timeout does not create a second outbox row", async () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "hello"));
    const before = runtime.store.pendingOutbox().length;
    await deliverOutbox(runtime, async () => {
      throw new Error("timeout");
    });
    expect(runtime.store.pendingOutbox()).toHaveLength(before);
  });

  test("PING is silent unless diagnostics are on", () => {
    const runtime = makeRuntime();
    const quiet = stageIncoming(runtime, text("ada", "PING"));
    expect(quiet.replies[0]?.text ?? "").not.toContain("does not start a quest");
    runtime.config.diagnostics = true;
    const loud = stageIncoming(runtime, text("ada", "PING"));
    expect(loud.replies[0]?.text).toContain("does not start a quest");
    expect(runtime.store.findIdentity("demo", "demo", "ada")?.xp).toBe(0);
  });

  test("a provider block suppresses proactive prompts", () => {
    const runtime = makeRuntime();
    runtime.config.proactiveEnabled = true;
    stageIncoming(runtime, text("ada", "hello"));
    stageIncoming(runtime, text("ada", "REMINDERS ON"));
    const identity = runtime.store.findIdentity("demo", "demo", "ada")!;
    const prefs = runtime.store.preferences(identity.player_id)!;
    prefs.next_due_at = now;
    runtime.store.savePreferences(prefs, now);
    runtime.store.setProviderBlocked("registration", now);
    expect(runScheduler(runtime)).toHaveLength(0);
    expect(runtime.store.preferences(identity.player_id)?.next_due_at).toBe(now);
  });

  test("STOP suppresses a queued prompt before send", async () => {
    const runtime = makeRuntime();
    stageIncoming(runtime, text("ada", "hello"));
    const identity = runtime.store.findIdentity("demo", "demo", "ada")!;
    const conversation = runtime.store.latestConversation(identity.id)!;
    runtime.store.enqueue({
      operationKey: "prompt:test",
      conversationId: conversation.id,
      route: { providerConversationRef: conversation.provider_conversation_ref },
      text: "Optional Thaw prompt",
      at: now,
      purpose: "prompt",
    });
    stageIncoming(runtime, text("ada", "STOP"));
    await deliverOutbox(runtime, async (item) => {
      if (item.purpose === "prompt") throw new Error("prompt was sent after STOP");
      return {};
    });
    expect(runtime.store.pendingOutbox().some((item) => item.purpose === "prompt")).toBe(false);
  });

  test("a new phone number starts with the text form", () => {
    const runtime = makeRuntime();
    const sender = "+12065550100";
    const opened = stageIncoming(runtime, text(sender, "hi"));
    expect(opened.replies[0]?.text).toContain("What name");
    const player = runtime.store.findIdentity("demo", "demo", sender);
    expect(player?.xp).toBe(0);
    expect(player?.phone).toBe(sender);
    expect(player?.display_name).toBe("adventurer");
    expect(player?.profile_completed_at).toBeNull();
  });

  test("name, yes, and skip reach the place question and keep later XP", () => {
    const runtime = makeRuntime();
    const sender = "+12065550100";
    const place = completeTextSignup(runtime, sender, "Maya");
    expect(place.replies[0]?.text).toContain("city, neighborhood, or public landmark");
    stageIncoming(runtime, text(sender, "Capitol Hill"));
    stageIncoming(runtime, text(sender, "1"));
    const staged = stageIncoming(runtime, photo(sender));
    settleSubmission(runtime, staged.submissionId!, "success");
    const player = runtime.store.findIdentity("demo", "demo", sender);
    expect(player?.display_name).toBe("Maya");
    expect(player?.xp).toBe(60);
    expect(player?.profile_completed_at).toBeTruthy();
  });

  test("a second phone does not see another player's XP or photo", () => {
    const runtime = makeRuntime();
    const maya = "+12065550100";
    const sam = "+12065550199";
    completeTextSignup(runtime, maya, "Maya");
    stageIncoming(runtime, text(maya, "Capitol Hill"));
    stageIncoming(runtime, text(maya, "1"));
    const staged = stageIncoming(runtime, photo(maya));
    settleSubmission(runtime, staged.submissionId!, "success");
    completeTextSignup(runtime, sam, "Sam");
    const status = stageIncoming(runtime, text(sam, "STATUS"));
    expect(status.replies[0]?.text).toContain("0 XP");
    expect(status.replies[0]?.text).not.toContain("Hidden Detail");
    const mayaPlayer = runtime.store.findIdentity("demo", "demo", maya);
    const samPlayer = runtime.store.findIdentity("demo", "demo", sam);
    expect(mayaPlayer?.player_id).not.toBe(samPlayer?.player_id);
    expect(mayaPlayer?.xp).toBe(60);
    expect(samPlayer?.xp).toBe(0);
    expect(runtime.store.activeAttemptForPlayer(samPlayer!.player_id)).toBeUndefined();
  });

  test("a photo during name collection creates no submission and no XP", () => {
    const runtime = makeRuntime();
    const sender = "+12065550100";
    stageIncoming(runtime, text(sender, "hi"));
    const shot = stageIncoming(runtime, photo(sender));
    expect(shot.submissionId).toBeUndefined();
    expect(shot.replies[0]?.text).toContain("Finish signup");
    expect(shot.replies[0]?.text).toContain("What name");
    expect(shot.replies.join("\n")).not.toContain("Got your photo");
    const player = runtime.store.findIdentity("demo", "demo", sender);
    expect(player?.xp).toBe(0);
    expect(runtime.store.latestConversation(player!.id)?.phase).toBe("COLLECT_NAME");
  });

  test("a restart after the name question asks for the phone", () => {
    const runtime = makeRuntime();
    const sender = "+12065550100";
    stageIncoming(runtime, text(sender, "hi"));
    const asked = stageIncoming(runtime, text(sender, "Maya"));
    expect(asked.replies[0]?.text).toContain("ending in 00");
    expect(asked.replies[0]?.text).not.toContain(sender);
    runtime.store.close();
    const restarted = reopen(runtime);
    const again = stageIncoming(restarted, text(sender, "hello"));
    expect(again.replies[0]?.text.toLowerCase()).toContain("phone");
    expect(again.replies[0]?.text).not.toContain("What name");
    expect(restarted.store.findIdentity("demo", "demo", sender)?.display_name).toBe("Maya");
    restarted.store.close();
  });

  test("a demo sender skips the text form", () => {
    const runtime = makeRuntime();
    const result = stageIncoming(runtime, text("ada", "hello"));
    expect(result.replies[0]?.text).toContain("What city, neighborhood, or public landmark");
    const ada = runtime.store.findIdentity("demo", "demo", "ada");
    expect(ada?.display_name).toBe("adventurer");
    expect(ada?.phone).toBeNull();
    expect(ada?.email).toBeNull();
    expect(ada?.profile_completed_at).toBeNull();
  });

  test("NAME after signup changes the name and leaves XP in place", () => {
    const runtime = makeRuntime();
    const sender = "+12065550100";
    completeTextSignup(runtime, sender, "Maya");
    stageIncoming(runtime, text(sender, "Capitol Hill"));
    stageIncoming(runtime, text(sender, "1"));
    const staged = stageIncoming(runtime, photo(sender));
    settleSubmission(runtime, staged.submissionId!, "success");
    const identity = runtime.store.findIdentity("demo", "demo", sender)!;
    const phase = runtime.store.latestConversation(identity.id)?.phase;
    const renamed = stageIncoming(runtime, text(sender, "NAME Jordan"));
    expect(renamed.replies[0]?.text).toContain("name is updated");
    const player = runtime.store.findIdentity("demo", "demo", sender);
    expect(player?.display_name).toBe("Jordan");
    expect(player?.xp).toBe(60);
    expect(runtime.store.latestConversation(identity.id)?.phase).toBe(phase);
  });

  test("a phone already stored on another player is rejected", () => {
    const runtime = makeRuntime();
    const phone = "+12065550100";
    const email = "sam@example.com";
    stageIncoming(runtime, text(phone, "hi"));
    stageIncoming(runtime, text(email, "hi"));
    stageIncoming(runtime, text(email, "Sam"));
    const rejected = stageIncoming(runtime, text(email, phone));
    expect(rejected.replies[0]?.text).toContain("already on another score");
    const owner = runtime.store.findIdentity("demo", "demo", phone);
    const other = runtime.store.findIdentity("demo", "demo", email);
    expect(owner?.player_id).not.toBe(other?.player_id);
    expect(owner?.phone).toBe(phone);
    expect(owner?.xp).toBe(0);
    expect(other?.phone).toBeNull();
    expect(other?.email).toBe(email);
  });
});

describe("configuration", () => {
  test("live verification fails closed without a server key", () => {
    expect(() => loadConfig({ THAW_VERIFIER: "live", THAW_TRANSPORT: "demo" })).toThrow(/GEMINI_API_KEY/);
  });

  test("live verification can be configured when the server key is present", () => {
    const config = loadConfig({ THAW_VERIFIER: "live", THAW_TRANSPORT: "demo", GEMINI_API_KEY: "test-key" });
    expect(config.verifier).toBe("live");
    expect(config.geminiApiKey).toBe("test-key");
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

function completeTextSignup(runtime: Runtime, sender: string, name: string) {
  stageIncoming(runtime, text(sender, "hi"));
  stageIncoming(runtime, text(sender, name));
  stageIncoming(runtime, text(sender, "YES"));
  return stageIncoming(runtime, text(sender, "SKIP"));
}
