import { levelForXp, xpUntilNextLevel, type PlaceOption, type QuestTemplate, type SelectedPlace } from "../game/quests.ts";

export function welcome(resume: boolean): string {
  if (resume) {
    return "Welcome back. Your progress is still here. Reply QUEST for an adventure, STATUS for your progress, or LOCATION to pick a place.";
  }
  return "Hey, I'm Thaw. I'll help you find a small adventure nearby. What city, neighborhood, or public landmark would you like to explore?";
}

export function askLocation(): string {
  return "What city, neighborhood, or public landmark should we explore? A public place you already know is perfect.";
}

export function ambiguousLocation(options: PlaceOption[]): string {
  const lines = options.map((option, index) => `${index + 1}. ${option.label}`);
  return `I found more than one demo place with that name. Which one did you mean?\n${lines.join("\n")}\nReply ${options.map((_, index) => index + 1).join(" or ")}, or send a different place. These are labeled demo choices, not a live map search.`;
}

export function confirmUserPlace(place: SelectedPlace): string {
  return `We'll explore ${place.label} as a public place you named. Thaw is not using your phone's GPS.`;
}

export function questMenu(place: SelectedPlace, quests: QuestTemplate[]): string {
  const lines = quests.map((quest, index) => `${index + 1}. ${quest.title} — ${quest.description}`);
  return `${confirmUserPlace(place)}\n\nPick your next adventure:\n${lines.join("\n")}\nReply ${quests.map((_, index) => index + 1).join(", ")}.`;
}

export function invalidChoice(max: number): string {
  return `Reply with a number from 1 to ${max}.`;
}

export function acceptedQuest(place: SelectedPlace, quest: QuestTemplate, demoVerifier: boolean): string {
  const check = demoVerifier
    ? "Demo verification: the photo check is simulated. It does not prove where or when the photo was taken."
    : "Submitted photos are checked against this quest. Please don't send faces or personal documents.";
  return [
    `Your quest: ${quest.title}`,
    `Go to ${place.label} and ${lowercaseFirst(quest.instructions)}`,
    `Photo to send: ${quest.photoRequirement}`,
    quest.accessibility,
    "Use the camera or photo button in Messages, then send one clear picture here.",
    `Reward: ${quest.xp} XP + ${quest.collectibleName}.`,
    check,
    "Reply HELP, CANCEL, or REMIND 15 any time.",
  ].join("\n");
}

export function alreadyEarned(quest: QuestTemplate): string {
  return `You already earned ${quest.title}. Pick a different number, or reply LOCATION for another place.`;
}

export function photoNeedsQuest(): string {
  return "I got a photo, but you don't have an active quest yet, so I didn't check it or award anything. Reply QUEST to pick one.";
}

export function stillChecking(title: string): string {
  return `I'm still checking your photo for ${title}. I'll reply when that finishes. Send another picture only if you want a new try after that.`;
}

export function photoAck(): string {
  return "Got your photo. I'm checking it against your quest.";
}

export function photoRejected(detail: string): string {
  return `${detail} Your quest is still active. Send one JPEG or PNG when you're ready.`;
}

export function ignoredExtraPhotos(): string {
  return "I used the first photo I could read. Send one picture at a time if you want me to check a different one.";
}

export function demoSuccess(input: { xp: number; collectible: string; totalXp: number }): string {
  const level = levelForXp(input.totalXp);
  return `Demo verification. Quest complete! You earned ${input.xp} XP and unlocked ${input.collectible}. You're now level ${level}. Reply NEXT for another adventure or COLLECTION to see your finds.`;
}

export function demoRetry(quest: QuestTemplate, unmet: string): string {
  return `Demo verification. I couldn't clearly see ${uncapitalize(unmet)}. Your quest is still active. Try this: ${quest.retryHint} Then send another photo.`;
}

export function demoUnavailable(): string {
  return "Demo verification. The photo check is unavailable right now. Your quest and photo submission are saved. Reply STATUS to check again.";
}

export function helpText(): string {
  return [
    "Thaw by text:",
    "LOCATION — name a public place",
    "QUEST — see up to three adventures",
    "Send one photo — check your active quest",
    "STATUS — XP, level, and the active quest",
    "COLLECTION — pins you have unlocked",
    "REMIND 15 — one reminder in 15 minutes",
    "CANCEL — drop the active quest",
    "STOP — pause messages",
    "START — resume",
    "LINK and your code — connect the app",
  ].join("\n");
}

export function statusText(input: {
  xp: number;
  activeTitle?: string;
  verifying: boolean;
  latestCollectible?: string;
}): string {
  const level = levelForXp(input.xp);
  const lines = [`Level ${level} · ${input.xp} XP · ${xpUntilNextLevel(input.xp)} XP to level ${level + 1}.`];
  if (input.verifying && input.activeTitle) lines.push(`I'm checking a photo for ${input.activeTitle}.`);
  else if (input.activeTitle) lines.push(`Active quest: ${input.activeTitle}. Send one photo when you have it.`);
  else lines.push("No active quest. Reply QUEST to pick one.");
  if (input.latestCollectible) lines.push(`Latest find: ${input.latestCollectible}.`);
  return lines.join("\n");
}

export function collectionText(names: string[]): string {
  if (names.length === 0) return "You have not unlocked a collectible yet. Finish a quest to earn one.";
  return `Your finds:\n${names.map((name) => `- ${name}`).join("\n")}`;
}

export function replaceActive(title: string): string {
  return `${title} is still active. Reply KEEP to continue it, or CANCEL to drop it and pick another.`;
}

export function keptQuest(title: string): string {
  return `${title} is still your active quest. Send one photo when you have it.`;
}

export function cancelledQuest(): string {
  return "Cancelled. Your earned progress stays. Reply QUEST when you want another adventure.";
}

export function stopConfirmation(): string {
  return "Thaw is paused. I won't send reminders or quest messages. Text START when you want to resume. Progress you already earned stays saved.";
}

export function alreadyStopped(): string {
  return "Thaw is already paused. Text START when you want to resume.";
}

export function stoppedNudge(): string {
  return "Thaw is paused. Text START to resume.";
}

export function reminderSet(minutes: number, title: string): string {
  return `Okay. I'll remind you about ${title} in ${minutes} minutes. Reply CANCEL to drop the quest, or STOP to pause messages.`;
}

export function reminderBody(title: string, photo: string): string {
  return `Your Thaw reminder: ${title} is still active. When you're ready, send ${photo} Reply CANCEL to end the quest.`;
}

export function remindNeedsQuest(): string {
  return "There isn't an active quest to remind you about. Reply QUEST to pick one.";
}

export function remindOutOfRange(min: number, max: number): string {
  return `Reply REMIND and a number of minutes from ${min} to ${max}. For example: REMIND 15.`;
}

export function sendPhotoPrompt(title: string): string {
  return `${title} is active. Send one photo in this chat, or reply HELP.`;
}

export function linkStarted(masked: string): string {
  return `I found code for this chat (${masked}). Open Thaw and confirm this connection. The code works once.`;
}

export function linkRejected(): string {
  return "That link code didn't work. Request a new code in the app and send LINK plus the new code.";
}

export function linkRateLimited(): string {
  return "Too many link attempts. Wait a few minutes, then request a new code in the app.";
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLocaleLowerCase("en-US") + value.slice(1);
}

function uncapitalize(value: string): string {
  return value.charAt(0).toLocaleLowerCase("en-US") + value.slice(1);
}
