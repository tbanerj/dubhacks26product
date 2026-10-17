import type { Landmark, Progress, Quest, QuestStatus } from '../types';
import { collectibleIdFor, isQuestCompleted } from './progression';

export interface ActiveQuest {
  questId: string;
  acceptedAt: string;
  /** Party quest being played via its solo alternative. */
  soloVersion: boolean;
  checkedIn: boolean;
}

export function questStatus(quest: Quest, progress: Progress, active: ActiveQuest | null, seen: readonly string[]): QuestStatus {
  if (isQuestCompleted(progress, quest.id)) return 'completed';
  if (active?.questId === quest.id) return 'active';
  if (!seen.includes(quest.id)) return 'new';
  return 'available';
}

export type HubState = 'active' | 'new' | 'coop' | 'available' | 'collectible' | 'completed';

/**
 * The single visual state of a quest hub (a landmark with quests), by priority:
 * active > new > co-op available > collectible still to earn > available > all done.
 */
export function hubState(
  landmark: Landmark,
  quests: Quest[],
  progress: Progress,
  active: ActiveQuest | null,
  seen: readonly string[],
): HubState {
  const here = quests.filter((q) => q.landmarkId === landmark.id);
  const statuses = here.map((q) => ({ q, s: questStatus(q, progress, active, seen) }));
  if (statuses.some((x) => x.s === 'active')) return 'active';
  const open = statuses.filter((x) => x.s !== 'completed');
  if (open.length === 0) return 'completed';
  if (open.some((x) => x.s === 'new')) return 'new';
  if (open.some((x) => x.q.mode === 'party')) return 'coop';
  const owned = new Set(progress.collectibles.map((c) => c.id));
  if (open.some((x) => !owned.has(collectibleIdFor(x.q)))) return 'collectible';
  return 'available';
}
