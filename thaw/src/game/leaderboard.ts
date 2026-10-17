import type { PlayerProfile, Progress } from '../types';
import { DEMO_RIVALS, rivalDailyXp } from '../data/demoPeople';
import { dailyXp } from './progression';
import { localDayKey } from './dates';

export type BoardKind = 'daily' | 'allTime' | 'quests' | 'landmarks';

export interface BoardRow {
  id: string;
  name: string;
  avatarHue: number;
  value: number;
  rank: number;
  isSelf: boolean;
  isDemo: boolean;
}

/** Local device leaderboard: your real progress vs. clearly-labelled demo profiles. */
export function buildLeaderboard(kind: BoardKind, player: PlayerProfile, progress: Progress, today = localDayKey()): BoardRow[] {
  const selfValue =
    kind === 'daily'
      ? dailyXp(progress, today)
      : kind === 'allTime'
        ? progress.totalXp
        : kind === 'quests'
          ? progress.completions.length
          : progress.visitedLandmarkIds.length;

  const rows = [
    { id: player.id, name: player.name, avatarHue: player.avatarHue, value: selfValue, isSelf: true, isDemo: false },
    ...DEMO_RIVALS.map((r) => ({
      id: r.id,
      name: r.name,
      avatarHue: r.avatarHue,
      value: kind === 'daily' ? rivalDailyXp(r.id, today) : kind === 'allTime' ? r.totalXp : kind === 'quests' ? r.quests : r.landmarks,
      isSelf: false,
      isDemo: true,
    })),
  ];

  // Ties: the player ranks above demo profiles (feels fair and is deterministic).
  rows.sort((a, b) => b.value - a.value || Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name));

  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (r.value !== prev) rank = i + 1;
    prev = r.value;
    return { ...r, rank };
  });
}
