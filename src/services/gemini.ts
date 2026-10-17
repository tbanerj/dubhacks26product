/**
 * Quest generation. Gemini runs server-side in the `generate-quests` Edge Function (the API
 * key never ships in the app). Every returned quest is re-validated and safety-filtered here,
 * and any place without a valid AI quest gets one from the built-in templates. The return
 * shape is identical either way, and this never throws.
 */
import type { Landmark, LatLng, Quest } from '../types';
import { distanceMeters } from '../game/geo';
import { RawQuestListSchema, validateQuest } from '../game/questSchema';
import { generateLocalQuests, timeOfDay } from '../game/localQuests';
import { supabase } from './supabase/client';

export interface QuestRequest {
  landmarks: Landmark[];
  playerPosition: LatLng;
  localeHint: string;
  regionName: string | null;
  partySize: number;
  preferSolo: boolean;
  mobilityFriendly: boolean;
  /** Ask the server for AI quests (requires a signed-in session). */
  useAi: boolean;
  now?: Date;
}

export interface QuestBatch {
  quests: Quest[];
  source: 'gemini' | 'local' | 'mixed';
  note: string | null;
}

function applyPreferences(quests: Quest[], req: Pick<QuestRequest, 'preferSolo' | 'mobilityFriendly'>): Quest[] {
  return quests.filter((q) => {
    if (req.preferSolo && q.mode !== 'solo') return false;
    if (req.mobilityFriendly && (q.durationMin > 25 || q.difficulty === 'hard')) return false;
    return true;
  });
}

async function fetchAiQuests(req: QuestRequest): Promise<unknown> {
  if (!supabase) throw new Error('unavailable');
  const { data, error } = await supabase.functions.invoke('generate-quests', {
    method: 'POST',
    body: {
      landmarks: req.landmarks.slice(0, 10).map((l) => ({
        landmarkId: l.id,
        name: l.name,
        category: l.category,
        distanceMeters: Math.round(distanceMeters(req.playerPosition, l.coordinate)),
      })),
      context: {
        localeHint: req.localeHint,
        regionName: req.regionName,
        timeOfDay: timeOfDay(req.now),
        partySize: req.partySize,
        preferSolo: req.preferSolo,
        mobilityFriendly: req.mobilityFriendly,
      },
    },
  });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    throw new Error(status === 503 ? 'unavailable' : status === 429 ? 'rate_limited' : 'failed');
  }
  return data;
}

export async function generateQuests(req: QuestRequest, timeoutMs = 25_000): Promise<QuestBatch> {
  const local = applyPreferences(generateLocalQuests(req.landmarks, { now: req.now }), req);
  if (!req.useAi || req.landmarks.length === 0) return { quests: local, source: 'local', note: null };

  try {
    const raw = await Promise.race([
      fetchAiQuests(req),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), timeoutMs)),
    ]);
    const list = RawQuestListSchema.safeParse(raw);
    if (!list.success) throw new Error('bad response');

    const byId = new Map(req.landmarks.map((l) => [l.id, l]));
    const ai: Quest[] = [];
    let rejected = 0;
    for (const item of list.data.quests) {
      const v = validateQuest(item, byId, 'gemini');
      if (v.ok) ai.push(v.quest);
      else rejected++;
    }
    const aiFiltered = applyPreferences(ai, req);
    const covered = new Set(aiFiltered.map((q) => q.landmarkId));
    const fill = local.filter((q) => !covered.has(q.landmarkId));
    const quests = [...aiFiltered, ...fill];
    const source = aiFiltered.length === 0 ? 'local' : fill.length === 0 ? 'gemini' : 'mixed';
    const note = rejected > 0 && aiFiltered.length > 0 ? `${rejected} AI quest${rejected === 1 ? '' : 's'} failed safety checks and were replaced.` : null;
    return { quests, source, note };
  } catch {
    // Unavailable / offline / rate limited: the built-in quests are complete on their own.
    return { quests: local, source: 'local', note: null };
  }
}
