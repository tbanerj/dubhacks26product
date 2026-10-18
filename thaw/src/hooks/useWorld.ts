import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, playerPosition } from '../store/useGameStore';
import { DISCOVERY_RADIUS_M, distanceMeters } from '../game/geo';
import { hubState, questStatus } from '../game/questStatus';
import type { Landmark, Quest, QuestStatus } from '../types';
import type { MapHub } from '../components/map/types';

export interface QuestEntry {
  quest: Quest;
  landmark: Landmark;
  status: QuestStatus;
  distanceM: number;
}

/** Derived world view: player position, hubs in range, and quests sorted by distance. */
export function useWorld() {
  const s = useGameStore(
    useShallow((st) => ({
      gpsPosition: st.gpsPosition,
      simulatedPosition: st.simulatedPosition,
      locationMode: st.locationMode,
      regionId: st.regionId,
      manualCenter: st.manualCenter,
      worldCenter: st.worldCenter,
      settings: st.settings,
      landmarks: st.landmarks,
      quests: st.quests,
      progress: st.progress,
      activeQuest: st.activeQuest,
      seenQuestIds: st.seenQuestIds,
    })),
  );

  const position = useMemo(
    () => playerPosition(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.gpsPosition, s.simulatedPosition, s.locationMode, s.regionId, s.manualCenter, s.worldCenter, s.settings.demoMode],
  );

  return useMemo(() => {
    const lmById = new Map(s.landmarks.map((l) => [l.id, l]));
    const entries: QuestEntry[] = [];
    for (const q of s.quests) {
      const lm = lmById.get(q.landmarkId);
      if (!lm) continue;
      const d = distanceMeters(position.coordinate, lm.coordinate);
      const status = questStatus(q, s.progress, s.activeQuest, s.seenQuestIds);
      // Discovery is distance-based; the active quest always stays visible.
      if (d > DISCOVERY_RADIUS_M && status !== 'active') continue;
      if (status !== 'active' && !questFitsSettings(q, s.settings)) continue;
      entries.push({ quest: q, landmark: lm, status, distanceM: d });
    }
    entries.sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.distanceM - b.distanceM);

    const hubLandmarks = [...new Set(entries.map((e) => e.landmark.id))].map((id) => lmById.get(id)!);
    const hubs: MapHub[] = hubLandmarks.map((landmark) => ({
      landmark,
      state: hubState(landmark, s.quests, s.progress, s.activeQuest, s.seenQuestIds),
    }));
    const active = s.activeQuest ? entries.find((e) => e.quest.id === s.activeQuest?.questId) ?? null : null;
    return { position, entries, hubs, active, lmById };
  }, [position, s.landmarks, s.quests, s.progress, s.activeQuest, s.seenQuestIds, s.settings.preferSolo, s.settings.mobilityFriendly]);
}

function questFitsSettings(quest: { mode: string; durationMin: number; difficulty: string }, settings: { preferSolo: boolean; mobilityFriendly: boolean }): boolean {
  if (settings.preferSolo && quest.mode !== 'solo') return false;
  if (settings.mobilityFriendly && (quest.durationMin > 25 || quest.difficulty === 'hard')) return false;
  return true;
}
