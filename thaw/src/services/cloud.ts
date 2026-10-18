/**
 * Cloud progress: reads the player's server-side state. Rewards are only ever granted
 * on the server (verify-evidence Edge Function -> complete_quest_verified); the client
 * mirrors what the server returns.
 */
import { z } from 'zod';
import type { CollectibleTheme, CompletionRecord, OwnedCollectible, Progress, Quest, Rarity } from '../types';
import { supabase } from './supabase/client';
import type { Database } from './supabase/database.types';
import { localDayKey, shiftDayKey } from '../game/dates';
import { MAX_COMPLETION_HISTORY } from '../game/progression';
import type { BoardKind } from '../game/leaderboard';
import { clampText } from '../utils/format';

type Tables = Database['public']['Tables'];

export interface CloudSnapshot {
  profile: { displayName: string; avatarHue: number; onboarded: boolean };
  progress: Progress;
}

const THEMES: readonly CollectibleTheme[] = ['botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood'];
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
const asTheme = (t: string): CollectibleTheme => (THEMES as readonly string[]).includes(t) ? (t as CollectibleTheme) : 'neighborhood';
const asRarity = (r: string): Rarity => (RARITIES as readonly string[]).includes(r) ? (r as Rarity) : 'common';

/** Pure mapping from DB rows to the app's Progress model (unit-tested). */
export function mapCloudRows(rows: {
  profile: Tables['profiles']['Row'] | null;
  stats: Tables['player_stats']['Row'] | null;
  completions: Tables['completions']['Row'][];
  collectibles: Tables['collectibles']['Row'][];
  daily: Tables['daily_xp']['Row'][];
  visited: Pick<Tables['visited_landmarks']['Row'], 'landmark_id'>[];
}): CloudSnapshot {
  const completions: CompletionRecord[] = rows.completions.map((c) => ({
    questId: c.quest_id,
    landmarkId: c.landmark_id,
    landmarkName: c.landmark_name,
    questTitle: c.quest_title,
    xp: c.xp,
    completedAt: c.completed_at,
    dayKey: c.day,
    collectibleId: c.collectible_id,
    partySize: c.party_size,
  }));
  const collectibles: OwnedCollectible[] = rows.collectibles.map((c) => ({
    id: c.collectible_id,
    name: c.name,
    theme: asTheme(c.theme),
    rarity: asRarity(c.rarity),
    landmarkName: c.landmark_name,
    unlockedAt: c.unlocked_at,
  }));
  const xpByDay: Record<string, number> = {};
  for (const d of rows.daily) xpByDay[d.day] = d.xp;
  return {
    profile: {
      displayName: rows.profile?.display_name ?? 'Explorer',
      avatarHue: rows.profile?.avatar_hue ?? 28,
      onboarded: !!rows.profile?.onboarded_at,
    },
    progress: {
      totalXp: rows.stats?.total_xp ?? 0,
      xpByDay,
      streak: rows.stats?.streak ?? 0,
      lastActiveDay: rows.stats?.last_active_day ?? null,
      completions,
      visitedLandmarkIds: rows.visited.map((v) => v.landmark_id),
      collectibles,
    },
  };
}

export type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string; retryable: boolean };

const offline = { ok: false as const, error: 'Accounts aren’t set up in this build.', retryable: false };

export async function fetchCloudSnapshot(userId: string): Promise<CloudResult<CloudSnapshot>> {
  try {
    return await fetchCloudSnapshotUnsafe(userId);
  } catch {
    return { ok: false, error: 'Couldn’t load your saved progress.', retryable: true };
  }
}

async function fetchCloudSnapshotUnsafe(userId: string): Promise<CloudResult<CloudSnapshot>> {
  if (!supabase) return offline;
  const since = shiftDayKey(localDayKey(), -31);
  const [profile, stats, completions, collectibles, daily, visited] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('completions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).limit(MAX_COMPLETION_HISTORY),
    supabase.from('collectibles').select('*').eq('user_id', userId).order('unlocked_at', { ascending: false }).limit(1000),
    supabase.from('daily_xp').select('*').eq('user_id', userId).gte('day', since),
    supabase.from('visited_landmarks').select('landmark_id').eq('user_id', userId).limit(5000),
  ]);
  const err = profile.error ?? stats.error ?? completions.error ?? collectibles.error ?? daily.error ?? visited.error;
  if (err) return { ok: false, error: 'Couldn’t load your saved progress.', retryable: true };
  return {
    ok: true,
    data: mapCloudRows({
      profile: profile.data,
      stats: stats.data,
      completions: completions.data ?? [],
      collectibles: collectibles.data ?? [],
      daily: daily.data ?? [],
      visited: visited.data ?? [],
    }),
  };
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Mark onboarding finished for this account (stored server-side so it follows the player). */
export async function completeCloudOnboarding(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}

export interface GlobalRow {
  rank: number;
  displayName: string;
  avatarHue: number;
  value: number;
  isSelf: boolean;
}

export async function fetchGlobalLeaderboard(kind: BoardKind, limit = 50): Promise<CloudResult<{ rows: GlobalRow[]; me: { rank: number; value: number; players: number } | null }>> {
  if (!supabase) return offline;
  const day = kind === 'daily' ? localDayKey() : undefined;
  let board, mine;
  try {
    [board, mine] = await Promise.all([
      supabase.rpc('get_leaderboard', { p_kind: kind, p_day: day, p_limit: limit }),
      supabase.rpc('get_my_rank', { p_kind: kind, p_day: day }),
    ]);
  } catch {
    return { ok: false, error: 'Couldn’t load the global leaderboard.', retryable: true };
  }
  if (board.error || mine.error) return { ok: false, error: 'Couldn’t load the global leaderboard.', retryable: true };
  const me = mine.data?.[0];
  return {
    ok: true,
    data: {
      rows: (board.data ?? []).map((r) => ({ rank: Number(r.rank), displayName: r.display_name, avatarHue: r.avatar_hue, value: Number(r.value), isSelf: r.is_self })),
      me: me ? { rank: Number(me.rank), value: Number(me.value), players: Number(me.players) } : null,
    },
  };
}

export interface ServerReward {
  duplicate: boolean;
  xp_gained: number;
  total_xp: number;
  streak: number;
  new_landmark: boolean;
  party_size?: number;
  collectible: { id: string; name: string; theme: string; rarity: string; landmark_name: string; unlocked_at: string } | null;
}

const RewardSchema = z.object({
  duplicate: z.boolean(),
  xp_gained: z.number(),
  total_xp: z.number(),
  streak: z.number(),
  new_landmark: z.boolean(),
  party_size: z.number().optional(),
  collectible: z
    .object({ id: z.string(), name: z.string(), theme: z.string(), rarity: z.string(), landmark_name: z.string(), unlocked_at: z.string() })
    .nullable(),
});

export type SubmitError = 'duplicate' | 'rate_limited' | 'daily_limit' | 'invalid' | 'network' | 'auth';

export async function submitCompletion(input: {
  quest: Quest;
  landmarkName: string;
  partySize: number;
  solo: boolean;
}): Promise<{ ok: true; reward: ServerReward } | { ok: false; error: SubmitError; message: string }> {
  if (!supabase) return { ok: false, error: 'auth', message: 'Accounts aren’t set up in this build.' };
  const mode = input.solo ? 'solo' : input.quest.mode;
  try {
    const { data, error } = await supabase.rpc('complete_quest', {
      p_quest_id: input.quest.id,
      p_landmark_id: input.quest.landmarkId,
      p_landmark_name: input.landmarkName,
      p_quest_title: input.quest.title,
      p_difficulty: input.quest.difficulty,
      p_mode: mode,
      p_party_size: mode === 'solo' ? 1 : input.partySize,
      p_collectible_theme: input.quest.collectible.theme,
      p_collectible_rarity: input.quest.collectible.rarity,
      p_collectible_name: input.quest.collectible.name,
      p_time_zone: deviceTimeZone(),
    });
    if (error) {
      const message = error.message ?? '';
      if (message.includes('rate_limited')) return { ok: false, error: 'rate_limited', message: 'Wait a few seconds between quests, then submit again.' };
      if (message.includes('daily_limit')) return { ok: false, error: 'daily_limit', message: 'You’ve hit today’s quest limit. Come back tomorrow for more.' };
      if (message.includes('invalid_input')) return { ok: false, error: 'invalid', message: 'This quest couldn’t be saved. Try another one.' };
      if (message.includes('not_authenticated')) return { ok: false, error: 'auth', message: 'Your session expired. Please sign in again.' };
      return { ok: false, error: 'network', message: 'Couldn’t save this quest. Check your connection.' };
    }
    const parsed = RewardSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: 'invalid', message: 'The server’s answer was unreadable.' };
    if (parsed.data.duplicate) return { ok: false, error: 'duplicate', message: 'This quest was already completed. Rewards are only granted once.' };
    return { ok: true, reward: parsed.data };
  } catch {
    return { ok: false, error: 'network', message: 'Couldn’t save this quest. Check your connection.' };
  }
}

export async function updateCloudProfile(userId: string, patch: { displayName?: string; avatarHue?: number }): Promise<boolean> {
  if (!supabase) return false;
  const update: Tables['profiles']['Update'] = {};
  if (patch.displayName !== undefined) update.display_name = clampText(patch.displayName, 24);
  if (patch.avatarHue !== undefined) update.avatar_hue = patch.avatarHue;
  try {
    const { error } = await supabase.from('profiles').update(update).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}
