/**
 * Centralised game rules. UI components never compute XP, levels or rewards
 * themselves – they call into this module (via the store).
 */
import type { CompletionRecord, OwnedCollectible, Progress, Quest, RewardSummary, Difficulty } from '../types';
import { dayDiff, localDayKey, shiftDayKey } from './dates';

// ---------- Levels ----------

export const MAX_LEVEL = 99;
/** XP needed to *reach* level L. L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000 … */
export function xpToReachLevel(level: number): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 50 * L * (L - 1);
}

export function levelForXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  // Invert 50L(L-1) <= xp  →  L <= (1 + sqrt(1 + 4xp/50)) / 2
  let level = Math.floor((1 + Math.sqrt(1 + (4 * safe) / 50)) / 2);
  level = Math.max(1, Math.min(MAX_LEVEL, level));
  // Guard against floating-point edge cases.
  while (level < MAX_LEVEL && xpToReachLevel(level + 1) <= safe) level++;
  while (level > 1 && xpToReachLevel(level) > safe) level--;
  return level;
}

export interface LevelProgress {
  level: number;
  intoLevel: number;
  levelSpan: number;
  fraction: number;
  toNext: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = xpToReachLevel(level);
  if (level >= MAX_LEVEL) return { level, intoLevel: xp - floor, levelSpan: 0, fraction: 1, toNext: 0 };
  const ceil = xpToReachLevel(level + 1);
  const span = ceil - floor;
  const into = xp - floor;
  return { level, intoLevel: into, levelSpan: span, fraction: span > 0 ? into / span : 1, toNext: ceil - xp };
}

// ---------- Quest XP ----------

export const BASE_XP: Record<Difficulty, number> = { easy: 60, medium: 90, hard: 130 };
export const FIRST_VISIT_BONUS = 20;
export const PARTY_BONUS_PER_MEMBER = 10;
export const MAX_PARTY_BONUS = 30;

export function partyBonus(partySize: number): number {
  return Math.min(MAX_PARTY_BONUS, Math.max(0, partySize - 1) * PARTY_BONUS_PER_MEMBER);
}

/** Clamp generated XP into a sane band around the difficulty baseline. */
export function normaliseQuestXp(difficulty: Difficulty, proposed: number | undefined): number {
  const base = BASE_XP[difficulty];
  if (proposed === undefined || !Number.isFinite(proposed)) return base;
  return Math.round(Math.min(base * 1.5, Math.max(base * 0.5, proposed)) / 5) * 5;
}

// ---------- Collectibles ----------

export function collectibleIdFor(quest: Pick<Quest, 'landmarkId' | 'collectible'>): string {
  return `pin:${quest.landmarkId}:${quest.collectible.theme}`;
}

// ---------- Streaks & daily XP ----------

/** Streak after being active on `today`. Same day keeps it; consecutive day extends it. */
export function nextStreak(prevStreak: number, lastActiveDay: string | null, today: string): number {
  if (!lastActiveDay) return 1;
  const diff = dayDiff(lastActiveDay, today);
  if (diff <= 0) return Math.max(1, prevStreak);
  if (diff === 1) return prevStreak + 1;
  return 1;
}

/** A streak is "live" only if the player was active today or yesterday. */
export function currentStreak(progress: Pick<Progress, 'streak' | 'lastActiveDay'>, today = localDayKey()): number {
  if (!progress.lastActiveDay) return 0;
  return dayDiff(progress.lastActiveDay, today) <= 1 ? progress.streak : 0;
}

export function dailyXp(progress: Pick<Progress, 'xpByDay'>, today = localDayKey()): number {
  return progress.xpByDay[today] ?? 0;
}

/** Keep only the last N days of daily XP so persistence never grows unbounded. */
export function pruneXpByDay(xpByDay: Record<string, number>, today: string, keepDays = 30): Record<string, number> {
  const cutoff = shiftDayKey(today, -keepDays);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(xpByDay)) if (k > cutoff) out[k] = v;
  return out;
}

export const MAX_COMPLETION_HISTORY = 200;

// ---------- Completion (the one place rewards are granted) ----------

export interface CompletionInput {
  quest: Quest;
  landmarkName: string;
  partySize: number;
  now?: Date;
}

export interface CompletionOutcome {
  progress: Progress;
  reward: RewardSummary | null;
  /** True if this quest had already been completed – nothing was granted. */
  duplicate: boolean;
}

export function isQuestCompleted(progress: Pick<Progress, 'completions'>, questId: string): boolean {
  return progress.completions.some((c) => c.questId === questId);
}

/**
 * Pure, idempotent reward application. Calling this twice with the same quest
 * returns `duplicate: true` the second time and leaves progress untouched.
 */
export function applyCompletion(progress: Progress, input: CompletionInput): CompletionOutcome {
  const { quest, landmarkName } = input;
  if (isQuestCompleted(progress, quest.id)) return { progress, reward: null, duplicate: true };

  const now = input.now ?? new Date();
  const today = localDayKey(now);
  const partySize = Math.max(1, Math.min(4, Math.floor(input.partySize)));
  const newLandmark = !progress.visitedLandmarkIds.includes(quest.landmarkId);

  const xpGained = quest.xp + partyBonus(partySize) + (newLandmark ? FIRST_VISIT_BONUS : 0);
  const levelBefore = levelForXp(progress.totalXp);
  const totalXp = progress.totalXp + xpGained;

  const collectibleId = collectibleIdFor(quest);
  const alreadyOwned = progress.collectibles.some((c) => c.id === collectibleId);
  const collectible: OwnedCollectible | null = alreadyOwned
    ? null
    : {
        id: collectibleId,
        name: quest.collectible.name,
        theme: quest.collectible.theme,
        rarity: quest.collectible.rarity,
        landmarkName,
        unlockedAt: now.toISOString(),
      };

  const record: CompletionRecord = {
    questId: quest.id,
    landmarkId: quest.landmarkId,
    landmarkName,
    questTitle: quest.title,
    xp: xpGained,
    completedAt: now.toISOString(),
    dayKey: today,
    collectibleId: collectible ? collectible.id : null,
    partySize,
  };

  const streak = nextStreak(progress.streak, progress.lastActiveDay, today);
  const xpByDay = pruneXpByDay({ ...progress.xpByDay, [today]: (progress.xpByDay[today] ?? 0) + xpGained }, today);

  const next: Progress = {
    totalXp,
    xpByDay,
    streak,
    lastActiveDay: today,
    completions: [record, ...progress.completions].slice(0, MAX_COMPLETION_HISTORY),
    visitedLandmarkIds: newLandmark ? [...progress.visitedLandmarkIds, quest.landmarkId] : progress.visitedLandmarkIds,
    collectibles: collectible ? [collectible, ...progress.collectibles] : progress.collectibles,
  };

  return {
    progress: next,
    duplicate: false,
    reward: { xpGained, levelBefore, levelAfter: levelForXp(totalXp), collectible, newLandmark, streak },
  };
}
