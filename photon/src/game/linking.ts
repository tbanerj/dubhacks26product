import { randomBytes } from "node:crypto";
import type { Runtime } from "./engine.ts";
import { hashCode, maskSender } from "./engine.ts";
import { getQuest, levelForXp, listQuests } from "./quests.ts";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function issueLinkCode(runtime: Runtime, appUserId: string): { code: string; expiresAt: string } {
  const now = runtime.now();
  const code = Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]!).join("");
  const expiresAt = new Date(now.getTime() + runtime.config.linkCodeTtlMs).toISOString();
  runtime.store.insertLinkToken({
    tokenHash: hashCode(code),
    appUserId,
    expiresAt,
    at: now.toISOString(),
  });
  return { code, expiresAt };
}

export function confirmLink(runtime: Runtime, appUserId: string): { ok: true; maskedSender: string } | { ok: false; error: string } {
  const now = runtime.now().toISOString();
  const token = runtime.store.pendingLinkForUser(appUserId);
  if (!token || !token.messaging_identity_id || token.state !== "pending" || Date.parse(token.expires_at) <= Date.parse(now)) {
    return { ok: false, error: "There is no pending Messages connection to confirm. Send LINK and the code from this chat first." };
  }
  const identity = runtime.store.findIdentityById(token.messaging_identity_id);
  if (!identity) return { ok: false, error: "That chat could not be found." };
  if (identity.linked_app_user && identity.linked_app_user !== appUserId) {
    runtime.store.setLinkState(token.id, "rejected");
    return { ok: false, error: "This chat is already linked to another Thaw account. Both histories were kept." };
  }
  runtime.store.linkIdentity(identity.id, appUserId);
  runtime.store.setLinkState(token.id, "redeemed");
  runtime.store.markPlayerRewardsPending(identity.player_id);
  return { ok: true, maskedSender: maskSender(identity.sender_id) };
}

export function progressForLinkedUser(runtime: Runtime, appUserId: string) {
  const identity = runtime.store.identityForAppUser(appUserId);
  if (!identity) return { linked: false as const };
  const xp = runtime.store.playerXp(identity.player_id);
  const attempt = runtime.store.activeAttemptForPlayer(identity.player_id);
  const quest = attempt ? getQuest(attempt.quest_id, attempt.quest_version) : undefined;
  const collectibles = runtime.store.unlocks(identity.player_id).map((unlock) => ({
    id: unlock.collectible_id,
    name: listQuests().find((item) => item.collectibleId === unlock.collectible_id)?.collectibleName ?? unlock.collectible_id,
    unlockedAt: unlock.unlocked_at,
  }));
  return {
    linked: true as const,
    progressScope: identity.progress_scope,
    verification: runtime.config.verifier,
    xp,
    level: levelForXp(xp),
    activeQuest: quest ? { id: quest.id, title: quest.title, status: attempt?.status } : null,
    collectibles,
  };
}
