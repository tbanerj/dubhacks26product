import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Config } from "../config.ts";
import { isGreeting, parseCommand, type Command } from "../conversation/commands.ts";
import * as prompts from "../conversation/prompts.ts";
import type { ConversationRow, IdentityRow, Store } from "../db/store.ts";
import { parsePlace } from "../db/store.ts";
import type { IncomingMessage, MessageRoute, OutboxItem, StageResult } from "../messaging/contracts.ts";
import { inspectImage } from "./images.ts";
import { getQuest, listQuests, resolvePlace, type SelectedPlace } from "./quests.ts";

export interface Runtime {
  config: Config;
  store: Store;
  now: () => Date;
}

interface OfferOption {
  number: number;
  questId: string;
  version: number;
}

interface PendingChoice {
  kind: "place";
  options: Array<{ label: string; precision: SelectedPlace["precision"]; source: SelectedPlace["source"] }>;
}

export function stageIncoming(runtime: Runtime, input: IncomingMessage): StageResult {
  return runtime.store.transact(() => stageUnlocked(runtime, input));
}

export function settleSubmission(runtime: Runtime, submissionId: string, scenario: IncomingMessage["verifierScenario"]): OutboxItem[] {
  return runtime.store.transact(() => settleUnlocked(runtime, submissionId, scenario));
}

function stageUnlocked(runtime: Runtime, input: IncomingMessage): StageResult {
  const at = input.receivedAt;
  if (!runtime.store.insertInbox(input.projectScope, input.channel, input.messageId, at)) {
    return { replies: [], duplicate: true };
  }
  if (!input.text?.trim() && input.attachments.length === 0) {
    return { replies: [], duplicate: false };
  }
  const identity = runtime.store.upsertPlayer({
    id: crypto.randomUUID(),
    channel: input.channel,
    projectScope: input.projectScope,
    senderId: input.senderId,
    displayName: displayName(input.senderId),
    timezone: runtime.config.defaultTimezone,
    progressScope: runtime.config.verifier === "live" ? "live" : "demo",
    at,
  });
  const conversation = runtime.store.ensureConversation({ identityId: identity.id, route: input.route, at });
  const command = parseCommand(input.text);
  const replies: OutboxItem[] = [];
  const say = (text: string, key: string) => {
    const operationKey = `${input.messageId}:${key}`;
    if (runtime.store.enqueue({ operationKey, conversationId: conversation.id, route: routeOf(conversation), text, at })) {
      replies.push({ operationKey, conversationId: conversation.id, text, route: routeOf(conversation) });
    }
  };

  if (identity.opted_out) {
    if (command.type === "START") {
      runtime.store.setOptOut(identity.id, false);
      say(prompts.welcome(true), "start");
      return { replies, duplicate: false };
    }
    say(command.type === "STOP" ? prompts.alreadyStopped() : prompts.stoppedNudge(), "stopped");
    return { replies, duplicate: false };
  }

  if (command.type === "STOP") {
    runtime.store.setOptOut(identity.id, true);
    cancelActive(runtime, conversation, at);
    runtime.store.cancelRemindersForPlayer(identity.player_id);
    runtime.store.suppressPending(conversation.id);
    say(prompts.stopConfirmation(), "stop");
    return { replies, duplicate: false };
  }

  if (command.type === "HELP") {
    say(prompts.helpText(), "help");
    return { replies, duplicate: false };
  }
  if (command.type === "STATUS") {
    say(statusFor(runtime, identity, conversation), "status");
    return { replies, duplicate: false };
  }
  if (command.type === "COLLECTION") {
    say(collectionFor(runtime, identity.player_id), "collection");
    return { replies, duplicate: false };
  }
  if (command.type === "CANCEL") {
    cancelActive(runtime, conversation, at);
    conversation.phase = conversation.area_json ? "IDLE" : "AWAITING_LOCATION";
    conversation.active_attempt_id = null;
    runtime.store.saveConversation(conversation, at);
    say(prompts.cancelledQuest(), "cancel");
    return { replies, duplicate: false };
  }
  if (command.type === "REMIND") {
    say(scheduleReminder(runtime, identity, conversation, command.minutes, at), "remind");
    return { replies, duplicate: false };
  }
  if (command.type === "LINK") {
    say(redeemLink(runtime, identity, command.code), "link");
    return { replies, duplicate: false };
  }
  if (command.type === "START") {
    say(prompts.welcome(conversation.phase !== "NEW"), "start");
    if (conversation.phase === "NEW") {
      conversation.phase = "AWAITING_LOCATION";
      runtime.store.saveConversation(conversation, at);
    }
    return { replies, duplicate: false };
  }
  if (command.type === "LOCATION") {
    beginLocationChange(runtime, conversation, at, say);
    return { replies, duplicate: false };
  }
  if (command.type === "QUEST") {
    beginQuestRequest(runtime, identity, conversation, at, say);
    return { replies, duplicate: false };
  }

  if (input.attachments.length > 0 && command.type !== "CHOICE" && command.type !== "KEEP") {
    const submissionId = stagePhoto(runtime, identity, conversation, input, at, say);
    return { replies, submissionId, duplicate: false };
  }

  applyText(runtime, identity, conversation, command, at, say);
  return { replies, duplicate: false };
}

function beginLocationChange(
  runtime: Runtime,
  conversation: ConversationRow,
  at: string,
  say: (text: string, key: string) => void,
): void {
  const attempt = activeAttempt(runtime, conversation);
  if (attempt) {
    conversation.phase = "CONFIRMING_REPLACE";
    runtime.store.saveConversation(conversation, at);
    const quest = getQuest(attempt.quest_id, attempt.quest_version);
    say(prompts.replaceActive(quest?.title ?? "Your quest"), "replace");
    return;
  }
  conversation.phase = "AWAITING_LOCATION";
  conversation.pending_json = null;
  runtime.store.saveConversation(conversation, at);
  say(prompts.askLocation(), "location");
}

function beginQuestRequest(
  runtime: Runtime,
  identity: IdentityRow,
  conversation: ConversationRow,
  at: string,
  say: (text: string, key: string) => void,
): void {
  const attempt = activeAttempt(runtime, conversation);
  if (attempt && (attempt.status === "active" || attempt.status === "verifying")) {
    conversation.phase = "CONFIRMING_REPLACE";
    runtime.store.saveConversation(conversation, at);
    const quest = getQuest(attempt.quest_id, attempt.quest_version);
    say(prompts.replaceActive(quest?.title ?? "Your quest"), "replace");
    return;
  }
  const place = parsePlace(conversation.area_json);
  if (!place) {
    conversation.phase = "AWAITING_LOCATION";
    runtime.store.saveConversation(conversation, at);
    say(prompts.askLocation(), "need-place");
    return;
  }
  offerQuests(runtime, identity, conversation, place, at, say);
}

function applyText(
  runtime: Runtime,
  identity: IdentityRow,
  conversation: ConversationRow,
  command: Command,
  at: string,
  say: (text: string, key: string) => void,
): void {
  const text = command.type === "TEXT" ? command.text : command.type === "CHOICE" ? String(command.value) : "";
  if (conversation.phase === "NEW" || (conversation.phase === "IDLE" && !conversation.area_json)) {
    if (!text || isGreeting(text)) {
      conversation.phase = "AWAITING_LOCATION";
      runtime.store.saveConversation(conversation, at);
      say(prompts.welcome(false), "welcome");
      return;
    }
    conversation.phase = "AWAITING_LOCATION";
  }

  if (conversation.phase === "AWAITING_LOCATION" || (conversation.phase === "CONFIRMING_LOCATION" && command.type === "TEXT")) {
    const resolution = resolvePlace(text);
    if (resolution.kind === "empty") {
      say(prompts.askLocation(), "ask");
      return;
    }
    if (resolution.kind === "ambiguous") {
      conversation.phase = "CONFIRMING_LOCATION";
      const pending: PendingChoice = { kind: "place", options: resolution.options };
      conversation.pending_json = JSON.stringify(pending);
      runtime.store.saveConversation(conversation, at);
      say(prompts.ambiguousLocation(resolution.options), "ambiguous");
      return;
    }
    offerQuests(runtime, identity, conversation, resolution.place, at, say);
    return;
  }

  if (conversation.phase === "CONFIRMING_LOCATION") {
    const pending = parsePending(conversation.pending_json);
    if (command.type !== "CHOICE" || !pending || command.value < 1 || command.value > pending.options.length) {
      say(prompts.invalidChoice(pending?.options.length ?? 2), "bad-place");
      return;
    }
    const selected = pending.options[command.value - 1];
    if (!selected) {
      say(prompts.invalidChoice(pending.options.length), "bad-place");
      return;
    }
    offerQuests(runtime, identity, conversation, selected, at, say);
    return;
  }

  if (conversation.phase === "CHOOSING_QUEST") {
    chooseQuest(runtime, identity, conversation, command, at, say);
    return;
  }

  if (conversation.phase === "CONFIRMING_REPLACE") {
    if (command.type === "KEEP") {
      const attempt = activeAttempt(runtime, conversation);
      const quest = attempt ? getQuest(attempt.quest_id, attempt.quest_version) : undefined;
      conversation.phase = attempt ? "ACTIVE_QUEST" : "IDLE";
      runtime.store.saveConversation(conversation, at);
      say(prompts.keptQuest(quest?.title ?? "Your quest"), "keep");
      return;
    }
    if (command.type === "CANCEL") {
      cancelActive(runtime, conversation, at);
      const place = parsePlace(conversation.area_json);
      if (place) offerQuests(runtime, identity, conversation, place, at, say);
      else {
        conversation.phase = "AWAITING_LOCATION";
        runtime.store.saveConversation(conversation, at);
        say(prompts.askLocation(), "ask");
      }
      return;
    }
    const attempt = activeAttempt(runtime, conversation);
    const quest = attempt ? getQuest(attempt.quest_id, attempt.quest_version) : undefined;
    say(prompts.replaceActive(quest?.title ?? "Your quest"), "replace-again");
    return;
  }

  const attempt = activeAttempt(runtime, conversation);
  if (attempt?.status === "verifying") {
    const quest = getQuest(attempt.quest_id, attempt.quest_version);
    say(prompts.stillChecking(quest?.title ?? "your quest"), "busy");
    return;
  }
  if (attempt?.status === "active") {
    const quest = getQuest(attempt.quest_id, attempt.quest_version);
    say(prompts.sendPhotoPrompt(quest?.title ?? "Your quest"), "photo-please");
    return;
  }
  if (!text || isGreeting(text)) {
    say(prompts.welcome(true), "hello");
    return;
  }
  say("Reply QUEST to pick an adventure, STATUS for progress, or HELP for the command list.", "hint");
}

function chooseQuest(
  runtime: Runtime,
  identity: IdentityRow,
  conversation: ConversationRow,
  command: Command,
  at: string,
  say: (text: string, key: string) => void,
): void {
  const options = readOffer(runtime, conversation.offer_set_id);
  if (command.type !== "CHOICE" || !options.some((option) => option.number === command.value)) {
    say(prompts.invalidChoice(options.length || 3), "bad-quest");
    return;
  }
  const option = options.find((item) => item.number === (command.type === "CHOICE" ? command.value : -1));
  const quest = option ? getQuest(option.questId, option.version) : undefined;
  if (!option || !quest) {
    say(prompts.invalidChoice(options.length || 3), "bad-quest");
    return;
  }
  if (runtime.store.hasQuestReward(identity.player_id, quest.id)) {
    say(prompts.alreadyEarned(quest), "earned");
    return;
  }
  const place = parsePlace(conversation.area_json);
  if (!place) {
    conversation.phase = "AWAITING_LOCATION";
    runtime.store.saveConversation(conversation, at);
    say(prompts.askLocation(), "need-place");
    return;
  }
  if (!conversation.offer_set_id) {
    say(prompts.invalidChoice(options.length || 3), "bad-quest");
    return;
  }
  const attemptId = runtime.store.insertAttempt({
    playerId: identity.player_id,
    conversationId: conversation.id,
    questId: quest.id,
    questVersion: quest.version,
    offerSetId: conversation.offer_set_id,
    at,
  });
  conversation.phase = "ACTIVE_QUEST";
  conversation.active_attempt_id = attemptId;
  conversation.pending_json = null;
  runtime.store.saveConversation(conversation, at);
  say(prompts.acceptedQuest(place, quest, runtime.config.verifier === "demo"), "accepted");
}

function offerQuests(
  runtime: Runtime,
  identity: IdentityRow,
  conversation: ConversationRow,
  place: SelectedPlace,
  at: string,
  say: (text: string, key: string) => void,
): void {
  const quests = listQuests();
  const options: OfferOption[] = quests.map((quest, index) => ({ number: index + 1, questId: quest.id, version: quest.version }));
  const offerId = runtime.store.insertOffer({
    playerId: identity.player_id,
    conversationId: conversation.id,
    optionsJson: JSON.stringify(options),
    at,
  });
  conversation.phase = "CHOOSING_QUEST";
  conversation.area_json = JSON.stringify(place);
  conversation.offer_set_id = offerId;
  conversation.pending_json = null;
  conversation.active_attempt_id = null;
  runtime.store.saveConversation(conversation, at);
  say(prompts.questMenu(place, quests), "menu");
}

function stagePhoto(
  runtime: Runtime,
  _identity: IdentityRow,
  conversation: ConversationRow,
  input: IncomingMessage,
  at: string,
  say: (text: string, key: string) => void,
): string | undefined {
  const attempt = activeAttempt(runtime, conversation);
  if (!attempt || attempt.status === "cancelled" || attempt.status === "completed") {
    say(prompts.photoNeedsQuest(), "no-quest");
    return undefined;
  }
  const quest = getQuest(attempt.quest_id, attempt.quest_version);
  if (attempt.status === "verifying") {
    say(prompts.stillChecking(quest?.title ?? "your quest"), "busy");
    return undefined;
  }
  const readable = input.attachments.filter((item) => item.bytes && !item.rejected);
  const rejected = input.attachments.filter((item) => item.rejected || !item.bytes);
  if (readable.length === 0) {
    const reason = rejected[0]?.rejected === "too_large" ? "That photo is over Thaw's size limit." : "Thaw could not read that attachment.";
    say(prompts.photoRejected(reason), "rejected");
    return undefined;
  }
  const chosen = readable[0]!;
  const inspected = inspectImage(chosen.bytes!, {
    maxBytes: runtime.config.maxImageBytes,
    maxPixels: runtime.config.maxImagePixels,
  });
  if (!inspected.ok) {
    say(prompts.photoRejected(inspected.detail), "rejected");
    return undefined;
  }
  mkdirSync(runtime.config.mediaDir, { recursive: true });
  const submissionKey = crypto.randomUUID();
  const mediaPath = `${runtime.config.mediaDir}/${submissionKey}.${inspected.format === "jpeg" ? "jpg" : "png"}`;
  writeFileSync(mediaPath, inspected.stored);
  const submissionId = runtime.store.insertSubmission({
    attemptId: attempt.id,
    messageId: input.messageId,
    attachmentId: chosen.attachmentId,
    mediaPath,
    contentHash: createHash("sha256").update(inspected.stored).digest("hex"),
    at,
  });
  if (!submissionId) {
    say(prompts.stillChecking(quest?.title ?? "your quest"), "dup-photo");
    return undefined;
  }
  runtime.store.setAttemptStatus(attempt.id, "verifying", at);
  conversation.phase = "VERIFYING";
  runtime.store.saveConversation(conversation, at);
  say(prompts.photoAck(), "ack");
  if (readable.length > 1) say(prompts.ignoredExtraPhotos(), "extra");
  return submissionId;
}

function settleUnlocked(runtime: Runtime, submissionId: string, scenario: IncomingMessage["verifierScenario"]): OutboxItem[] {
  const submission = runtime.store.submission(submissionId);
  if (!submission || submission.status !== "verifying") return [];
  const attempt = runtime.store.attempt(submission.attempt_id);
  if (!attempt) return [];
  const conversation = runtime.store.conversationByAttempt(attempt.id);
  const at = runtime.now().toISOString();
  if (!conversation) return [];
  const identity = runtime.store.findIdentityById(conversation.identity_id);
  if (identity?.opted_out || attempt.status === "cancelled") {
    runtime.store.finishSubmission(submission.id, "void", null, null, "Suppressed because the quest was cancelled or messaging stopped.");
    if (attempt.status === "verifying") runtime.store.setAttemptStatus(attempt.id, "cancelled", at);
    return [];
  }
  if (attempt.status !== "verifying") {
    runtime.store.finishSubmission(submission.id, "void", null, null, "Attempt was no longer verifying.");
    return [];
  }
  const quest = getQuest(attempt.quest_id, attempt.quest_version);
  if (!quest) {
    runtime.store.finishSubmission(submission.id, "failed", "unavailable", "demo", "Quest definition missing.");
    runtime.store.setAttemptStatus(attempt.id, "active", at);
    conversation.phase = "ACTIVE_QUEST";
    runtime.store.saveConversation(conversation, at);
    return enqueue(runtime, conversation, `${submission.id}:missing`, prompts.demoUnavailable(), at);
  }
  const chosen = runtime.config.allowVerifierScenarios ? scenario ?? "success" : "success";
  const source = runtime.config.verifier;
  if (chosen === "unavailable") {
    runtime.store.finishSubmission(submission.id, "saved", "unavailable", source, "Verifier unavailable.");
    runtime.store.setAttemptStatus(attempt.id, "active", at);
    conversation.phase = "ACTIVE_QUEST";
    runtime.store.saveConversation(conversation, at);
    return enqueue(runtime, conversation, `${submission.id}:unavailable`, prompts.demoUnavailable(), at);
  }
  if (chosen === "mismatch") {
    runtime.store.finishSubmission(submission.id, "retry", "retry", source, quest.rubric[0] ?? "the required detail");
    runtime.store.setAttemptStatus(attempt.id, "active", at);
    conversation.phase = "ACTIVE_QUEST";
    runtime.store.saveConversation(conversation, at);
    return enqueue(
      runtime,
      conversation,
      `${submission.id}:retry`,
      prompts.demoRetry(quest, quest.rubric[0] ?? "the required detail"),
      at,
    );
  }
  const granted = runtime.store.insertReward({
    playerId: attempt.player_id,
    attemptId: attempt.id,
    questId: quest.id,
    xpDelta: quest.xp,
    collectibleId: quest.collectibleId,
    source,
    operationKey: `reward:${attempt.player_id}:${quest.id}`,
    at,
  });
  runtime.store.finishSubmission(submission.id, "accepted", "accepted", source, "Demo verifier accepted the fixture rules for this scenario.");
  runtime.store.setAttemptStatus(attempt.id, "completed", at);
  runtime.store.cancelRemindersForAttempt(attempt.id);
  conversation.phase = "COMPLETED";
  conversation.active_attempt_id = null;
  runtime.store.saveConversation(conversation, at);
  if (!granted) {
    return enqueue(runtime, conversation, `${submission.id}:already`, prompts.alreadyEarned(quest), at);
  }
  const xp = runtime.store.playerXp(attempt.player_id);
  return enqueue(
    runtime,
    conversation,
    `reward-message:${attempt.id}`,
    prompts.demoSuccess({ xp: quest.xp, collectible: quest.collectibleName, totalXp: xp }),
    at,
  );
}

export function deliverDueReminders(runtime: Runtime): OutboxItem[] {
  const now = runtime.now();
  return runtime.store.transact(() => {
    const due = runtime.store.dueReminders(now.toISOString());
    const replies: OutboxItem[] = [];
    for (const job of due) {
      const attempt = runtime.store.attempt(job.attempt_id);
      const conversation = runtime.store.conversationById(job.conversation_id);
      const optedOut = runtime.store.optedOutConversation(job.conversation_id);
      const overdue = now.getTime() - Date.parse(job.due_at) > runtime.config.reminderStaleMs;
      if (!attempt || attempt.status !== "active" || !conversation || optedOut || overdue) {
        runtime.store.markReminder(job.id, overdue ? "expired" : "cancelled");
        continue;
      }
      const quest = getQuest(attempt.quest_id, attempt.quest_version);
      const text = prompts.reminderBody(quest?.title ?? "Your quest", quest?.photoRequirement ?? "one photo of the place.");
      const operationKey = `reminder:${job.id}`;
      const route = routeOf(conversation);
      if (runtime.store.enqueue({ operationKey, conversationId: conversation.id, route, text, at: now.toISOString() })) {
        replies.push({ operationKey, conversationId: conversation.id, text, route });
      }
      runtime.store.markReminder(job.id, "sent");
    }
    return replies;
  });
}

function scheduleReminder(
  runtime: Runtime,
  identity: IdentityRow,
  conversation: ConversationRow,
  minutes: number,
  at: string,
): string {
  const attempt = activeAttempt(runtime, conversation);
  if (!attempt || attempt.status !== "active") return prompts.remindNeedsQuest();
  if (minutes < runtime.config.reminderMinMinutes || minutes > runtime.config.reminderMaxMinutes) {
    return prompts.remindOutOfRange(runtime.config.reminderMinMinutes, runtime.config.reminderMaxMinutes);
  }
  const due = new Date(Date.parse(at) + minutes * 60 * 1000).toISOString();
  runtime.store.insertReminder({
    playerId: identity.player_id,
    attemptId: attempt.id,
    conversationId: conversation.id,
    dueAt: due,
    at,
  });
  const quest = getQuest(attempt.quest_id, attempt.quest_version);
  return prompts.reminderSet(minutes, quest?.title ?? "your quest");
}

function redeemLink(runtime: Runtime, identity: IdentityRow, code: string): string {
  const at = runtime.now().toISOString();
  const failures = runtime.store.linkFailureCount(identity.id, at, runtime.config.linkCodeTtlMs);
  if (failures >= runtime.config.linkMaxFailures) return prompts.linkRateLimited();
  const token = runtime.store.linkByHash(hashCode(code));
  const expired = !token || token.state !== "issued" || Date.parse(token.expires_at) <= Date.parse(at);
  if (expired || !token) {
    runtime.store.recordLinkFailure(identity.id, at, runtime.config.linkCodeTtlMs);
    return prompts.linkRejected();
  }
  runtime.store.setLinkPending(token.id, identity.id);
  return prompts.linkStarted(maskSender(identity.sender_id));
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toLocaleUpperCase("en-US")).digest("hex");
}

function cancelActive(runtime: Runtime, conversation: ConversationRow, at: string): void {
  if (!conversation.active_attempt_id) return;
  const attempt = runtime.store.attempt(conversation.active_attempt_id);
  if (attempt && (attempt.status === "active" || attempt.status === "verifying")) {
    runtime.store.setAttemptStatus(attempt.id, "cancelled", at);
    runtime.store.cancelRemindersForAttempt(attempt.id);
  }
  conversation.active_attempt_id = null;
}

function activeAttempt(runtime: Runtime, conversation: ConversationRow) {
  if (!conversation.active_attempt_id) return undefined;
  return runtime.store.attempt(conversation.active_attempt_id);
}

function statusFor(runtime: Runtime, identity: IdentityRow, conversation: ConversationRow): string {
  const attempt = activeAttempt(runtime, conversation);
  const quest = attempt ? getQuest(attempt.quest_id, attempt.quest_version) : undefined;
  const unlocks = runtime.store.unlocks(identity.player_id);
  const latest = unlocks.at(-1);
  const latestQuest = latest ? listQuests().find((item) => item.collectibleId === latest.collectible_id) : undefined;
  return prompts.statusText({
    xp: runtime.store.playerXp(identity.player_id),
    activeTitle: quest?.title,
    verifying: attempt?.status === "verifying",
    latestCollectible: latestQuest?.collectibleName,
  });
}

function collectionFor(runtime: Runtime, playerId: string): string {
  const names = runtime.store.unlocks(playerId).map((unlock) => {
    return listQuests().find((quest) => quest.collectibleId === unlock.collectible_id)?.collectibleName ?? unlock.collectible_id;
  });
  return prompts.collectionText(names);
}

function readOffer(runtime: Runtime, offerId: string | null): OfferOption[] {
  if (!offerId) return [];
  const json = runtime.store.offerOptions(offerId);
  if (!json) return [];
  const parsed = JSON.parse(json) as OfferOption[];
  return Array.isArray(parsed) ? parsed : [];
}

function parsePending(json: string | null): PendingChoice | undefined {
  if (!json) return undefined;
  const value = JSON.parse(json) as PendingChoice;
  if (value.kind !== "place" || !Array.isArray(value.options)) return undefined;
  return value;
}

function routeOf(conversation: ConversationRow): MessageRoute {
  return {
    providerConversationRef: conversation.provider_conversation_ref,
    servingLine: conversation.serving_line ?? undefined,
  };
}

function enqueue(runtime: Runtime, conversation: ConversationRow, operationKey: string, text: string, at: string): OutboxItem[] {
  const route = routeOf(conversation);
  if (!runtime.store.enqueue({ operationKey, conversationId: conversation.id, route, text, at })) return [];
  return [{ operationKey, conversationId: conversation.id, text, route }];
}

function displayName(senderId: string): string {
  if (senderId.startsWith("demo:")) return senderId.slice(5);
  return "adventurer";
}

export function maskSender(senderId: string): string {
  if (senderId.startsWith("demo:")) return senderId;
  if (senderId.length <= 4) return "••••";
  return `••••${senderId.slice(-2)}`;
}
