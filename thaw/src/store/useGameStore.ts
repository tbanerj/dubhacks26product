/**
 * Single typed source of truth. Game rules live in `src/game/*`; this store only
 * orchestrates services and applies the results. Components read with selectors.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConnectionState,
  ChatMessage,
  Landmark,
  LatLng,
  LocationMode,
  NearbyPlayer,
  Party,
  PlayerProfile,
  Progress,
  Quest,
  RewardSummary,
  VerificationResult,
} from '../types';
import { zustandStorage, clearCache } from '../services/storage';
import { DEMO_PLAYER_PROFILE } from '../data/demoPeople';
import { DEMO_REGIONS, GENERIC_REGION_ID, regionById, sampleSpotsAround, seededLandmarks } from '../data/regions';
import { localDayKey, shiftDayKey } from '../game/dates';
import { applyCompletion, levelForXp } from '../game/progression';
import { CHECK_IN_RADIUS_M, distanceMeters, isValidCoordinate, offsetMeters } from '../game/geo';
import type { ActiveQuest } from '../game/questStatus';
import { discoverPlaces } from '../services/places';
import { generateQuests } from '../services/gemini';
import * as LocationService from '../services/location';
import { partyService, type PartySnapshot } from '../services/photon';
import { deviceUnitSystem, clampText, deviceLocale, type UnitSystem } from '../utils/format';

export type WorldStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Settings {
  units: UnitSystem;
  preferSolo: boolean;
  mobilityFriendly: boolean;
  /** Demo helpers (simulated walking, simulated verification outcomes). */
  demoMode: boolean;
  onboarded: boolean;
}

interface PersistedState {
  player: PlayerProfile;
  progress: Progress;
  settings: Settings;
  locationMode: LocationMode;
  regionId: string;
  manualCenter: LatLng | null;
  worldCenter: LatLng | null;
  landmarks: Landmark[];
  quests: Quest[];
  questSource: 'gemini' | 'local' | 'mixed';
  activeQuest: ActiveQuest | null;
  seenQuestIds: string[];
}

interface TransientState {
  hydrated: boolean;
  gpsPosition: LatLng | null;
  simulatedPosition: LatLng | null;
  permission: LocationService.PermissionState;
  worldStatus: WorldStatus;
  worldNote: string | null;
  lastReward: RewardSummary | null;
  connection: ConnectionState;
  party: Party | null;
  chat: ChatMessage[];
  nearbyPlayers: NearbyPlayer[];
}

export type AcceptResult = { ok: true } | { ok: false; reason: 'needs-party' | 'unknown-quest' | 'already-completed' };
export type CompleteResult = { ok: true; reward: RewardSummary } | { ok: false; reason: 'no-active-quest' | 'not-accepted' | 'duplicate' };

interface Actions {
  markHydrated(): void;
  finishOnboarding(): void;
  setPlayerName(name: string): void;
  setAvatarHue(hue: number): void;
  updateSettings(patch: Partial<Settings>): void;

  enableGps(): Promise<{ ok: boolean; reason?: string }>;
  refreshGps(): Promise<void>;
  setRegion(regionId: string): Promise<void>;
  setManualCenter(center: LatLng): Promise<void>;
  reloadWorld(): Promise<void>;

  markSeen(questIds: string[]): void;
  acceptQuest(questId: string, opts?: { solo?: boolean }): AcceptResult;
  abandonQuest(): void;
  simulateWalkTo(landmarkId: string): void;
  clearSimulatedPosition(): void;
  checkIn(): { ok: boolean; distanceM: number | null };
  completeActiveQuest(verification: VerificationResult): CompleteResult;
  clearLastReward(): void;

  connectParty(): void;
  createParty(): void;
  joinHostedParty(hostId: string): void;
  invitePlayer(playerId: string): void;
  leaveParty(): void;
  setReady(ready: boolean): void;
  sendChat(text: string): void;

  resetDemo(): Promise<void>;
}

export type GameState = PersistedState & TransientState & Actions;

// ---------- Seed ----------

function seedProgress(now = new Date()): Progress {
  const today = localDayKey(now);
  const yesterday = shiftDayKey(today, -1);
  return {
    totalXp: 140,
    xpByDay: { [yesterday]: 140 },
    streak: 1,
    lastActiveDay: yesterday,
    completions: [
      {
        questId: 'seed-first-steps',
        landmarkId: 'seed-home',
        landmarkName: 'Your first walk',
        questTitle: 'First Steps',
        xp: 140,
        completedAt: new Date(now.getTime() - 86_400_000).toISOString(),
        dayKey: yesterday,
        collectibleId: 'pin:seed-home:neighborhood',
        partySize: 1,
      },
    ],
    visitedLandmarkIds: ['seed-home'],
    collectibles: [
      {
        id: 'pin:seed-home:neighborhood',
        name: 'First Steps Doorway',
        theme: 'neighborhood',
        rarity: 'common',
        landmarkName: 'Your first walk',
        unlockedAt: new Date(now.getTime() - 86_400_000).toISOString(),
      },
    ],
  };
}

function initialPersisted(): PersistedState {
  return {
    player: { ...DEMO_PLAYER_PROFILE },
    progress: seedProgress(),
    settings: { units: deviceUnitSystem(), preferSolo: false, mobilityFriendly: false, demoMode: true, onboarded: false },
    locationMode: 'region',
    regionId: 'seattle',
    manualCenter: null,
    worldCenter: null,
    landmarks: [],
    quests: [],
    questSource: 'local',
    activeQuest: null,
    seenQuestIds: [],
  };
}

const initialTransient: TransientState = {
  hydrated: false,
  gpsPosition: null,
  simulatedPosition: null,
  permission: 'unknown',
  worldStatus: 'idle',
  worldNote: null,
  lastReward: null,
  connection: 'offline',
  party: null,
  chat: [],
  nearbyPlayers: [],
};

// ---------- Derived helpers (exported for screens) ----------

/** Where the player is for game purposes, and whether that's real GPS. */
export function playerPosition(
  s: Pick<GameState, 'gpsPosition' | 'simulatedPosition' | 'locationMode' | 'regionId' | 'manualCenter'> & { worldCenter?: LatLng | null },
): {
  coordinate: LatLng;
  kind: 'gps' | 'simulated' | 'sample' | 'manual';
} {
  if (s.simulatedPosition) return { coordinate: s.simulatedPosition, kind: 'simulated' };
  if (s.locationMode === 'gps' && s.gpsPosition) return { coordinate: s.gpsPosition, kind: 'gps' };
  if (s.locationMode === 'manual' && s.manualCenter) return { coordinate: s.manualCenter, kind: 'manual' };
  // "Anywhere" sample mode is anchored wherever it was started.
  if (s.regionId === GENERIC_REGION_ID && s.worldCenter) return { coordinate: s.worldCenter, kind: 'sample' };
  const region = regionById(s.regionId) ?? DEMO_REGIONS[0]!;
  return { coordinate: region.center, kind: 'sample' };
}

export function partySizeOf(party: Party | null): number {
  return party ? party.members.length : 1;
}

let worldRequestId = 0;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** Fetch landmarks + quests around a centre. Fast local result first, AI quests after. */
      const loadWorld = async (center: LatLng, mode: LocationMode, regionId: string): Promise<void> => {
        const requestId = ++worldRequestId;
        set({ worldStatus: 'loading', worldNote: null });
        const region = regionById(regionId);

        let landmarks: Landmark[] = [];
        let note: string | null = null;

        if (mode === 'region') {
          landmarks = regionId === GENERIC_REGION_ID ? sampleSpotsAround(center) : seededLandmarks(regionId);
        } else {
          const res = await discoverPlaces(center);
          if (requestId !== worldRequestId) return;
          if (res.ok && res.landmarks.length >= 2) {
            landmarks = res.landmarks;
          } else {
            // Graceful fallback for sparse or unreachable map data.
            const nearSeed = DEMO_REGIONS.find((r) => r.id !== GENERIC_REGION_ID && distanceMeters(r.center, center) < 6_000);
            landmarks = nearSeed ? seededLandmarks(nearSeed.id) : sampleSpotsAround(center);
            if (res.ok && res.landmarks.length > 0) landmarks = [...res.landmarks, ...landmarks];
            note = res.ok
              ? 'Few mapped public places here, so Thaw added sample spots. Long-press the map to choose your own meeting point.'
              : `${res.reason} Showing ${nearSeed ? 'saved demo places' : 'sample spots'} instead.`;
          }
        }

        const prev = get();
        const active = prev.activeQuest ? prev.quests.find((q) => q.id === prev.activeQuest?.questId) : undefined;
        const activeLandmark = active ? prev.landmarks.find((l) => l.id === active.landmarkId) : undefined;
        if (activeLandmark && !landmarks.some((l) => l.id === activeLandmark.id)) landmarks = [activeLandmark, ...landmarks];

        const batchBase = {
          landmarks,
          playerPosition: center,
          localeHint: region?.localeHint ?? deviceLocale(),
          regionName: mode === 'region' ? (region?.name ?? null) : null,
          partySize: partySizeOf(prev.party),
          preferSolo: prev.settings.preferSolo,
          mobilityFriendly: prev.settings.mobilityFriendly,
        };

        const batch = await generateQuests(batchBase);
        if (requestId !== worldRequestId) return;
        let quests = batch.quests;
        if (active && !quests.some((q) => q.id === active.id)) quests = [active, ...quests];

        set({
          worldCenter: center,
          landmarks,
          quests,
          questSource: batch.source,
          worldStatus: 'ready',
          worldNote: [note, batch.note].filter(Boolean).join(' ') || null,
        });
      };

      const selfInfo = () => {
        const s = get();
        return { id: s.player.id, name: s.player.name, avatarHue: s.player.avatarHue, level: levelForXp(s.progress.totalXp) };
      };

      return {
        ...initialPersisted(),
        ...initialTransient,

        markHydrated: () => set({ hydrated: true }),
        finishOnboarding: () => set((s) => ({ settings: { ...s.settings, onboarded: true } })),
        setPlayerName: (name) => {
          const clean = clampText(name.replace(/[\u0000-\u001F]/g, ''), 24);
          if (clean) set((s) => ({ player: { ...s.player, name: clean } }));
        },
        setAvatarHue: (hue) => set((s) => ({ player: { ...s.player, avatarHue: ((Math.round(hue) % 360) + 360) % 360 } })),
        updateSettings: (patch) => {
          const before = get().settings;
          set((s) => ({ settings: { ...s.settings, ...patch } }));
          if (!patch.demoMode && patch.demoMode !== undefined) set({ simulatedPosition: null });
          if (
            (patch.preferSolo !== undefined && patch.preferSolo !== before.preferSolo) ||
            (patch.mobilityFriendly !== undefined && patch.mobilityFriendly !== before.mobilityFriendly)
          ) {
            void get().reloadWorld();
          }
        },

        enableGps: async () => {
          const perm = await LocationService.requestPermission();
          set({ permission: perm });
          if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'Location permission was declined.' : 'Location is unavailable on this device.' };
          const fix = await LocationService.getCurrentFix();
          if (!fix.ok) return { ok: false, reason: fix.reason };
          set({ gpsPosition: fix.coordinate, locationMode: 'gps', simulatedPosition: null });
          await loadWorld(fix.coordinate, 'gps', get().regionId);
          return { ok: true };
        },

        refreshGps: async () => {
          if (get().locationMode !== 'gps') return;
          const perm = await LocationService.getPermissionState();
          set({ permission: perm });
          if (perm !== 'granted') return;
          const fix = await LocationService.getCurrentFix();
          if (fix.ok) set({ gpsPosition: fix.coordinate });
        },

        setRegion: async (regionId) => {
          const region = regionById(regionId);
          if (!region) return;
          // "Anywhere" drops sample spots around the player's current (non-simulated) position.
          const s = get();
          const center = regionId === GENERIC_REGION_ID ? playerPosition({ ...s, simulatedPosition: null }).coordinate : region.center;
          set({ regionId, locationMode: 'region', simulatedPosition: null, manualCenter: null, worldCenter: center });
          await loadWorld(center, 'region', regionId);
        },

        setManualCenter: async (center) => {
          if (!isValidCoordinate(center)) return;
          set({ manualCenter: center, locationMode: 'manual', simulatedPosition: null });
          await loadWorld(center, 'manual', get().regionId);
        },

        reloadWorld: async () => {
          const s = get();
          const pos = playerPosition({ ...s, simulatedPosition: null });
          const center = s.locationMode === 'gps' ? pos.coordinate : (s.worldCenter ?? pos.coordinate);
          await loadWorld(center, s.locationMode, s.regionId);
        },

        markSeen: (questIds) => {
          const seen = get().seenQuestIds;
          const add = questIds.filter((id) => !seen.includes(id));
          if (add.length) set({ seenQuestIds: [...seen, ...add].slice(-500) });
        },

        acceptQuest: (questId, opts) => {
          const s = get();
          const quest = s.quests.find((q) => q.id === questId);
          if (!quest) return { ok: false, reason: 'unknown-quest' };
          if (s.progress.completions.some((c) => c.questId === questId)) return { ok: false, reason: 'already-completed' };
          const solo = !!opts?.solo;
          if (quest.mode === 'party' && !solo && partySizeOf(s.party) < quest.minParty) return { ok: false, reason: 'needs-party' };
          set({
            activeQuest: { questId, acceptedAt: new Date().toISOString(), soloVersion: solo && quest.mode !== 'solo', checkedIn: false },
            seenQuestIds: s.seenQuestIds.includes(questId) ? s.seenQuestIds : [...s.seenQuestIds, questId],
          });
          if (s.party && !solo) partyService.setQuest(questId);
          return { ok: true };
        },

        abandonQuest: () => set({ activeQuest: null }),

        simulateWalkTo: (landmarkId) => {
          const s = get();
          if (!s.settings.demoMode) return;
          const lm = s.landmarks.find((l) => l.id === landmarkId);
          if (lm) set({ simulatedPosition: offsetMeters(lm.coordinate, -25, 10) });
        },

        clearSimulatedPosition: () => set({ simulatedPosition: null }),

        checkIn: () => {
          const s = get();
          const active = s.activeQuest;
          const quest = active ? s.quests.find((q) => q.id === active.questId) : undefined;
          const lm = quest ? s.landmarks.find((l) => l.id === quest.landmarkId) : undefined;
          if (!active || !lm) return { ok: false, distanceM: null };
          const d = distanceMeters(playerPosition(s).coordinate, lm.coordinate);
          if (d > CHECK_IN_RADIUS_M) return { ok: false, distanceM: d };
          set({ activeQuest: { ...active, checkedIn: true } });
          return { ok: true, distanceM: d };
        },

        completeActiveQuest: (verification) => {
          const s = get();
          const active = s.activeQuest;
          if (!active) return { ok: false, reason: 'no-active-quest' };
          if (!verification.accepted) return { ok: false, reason: 'not-accepted' };
          const quest = s.quests.find((q) => q.id === active.questId);
          if (!quest) return { ok: false, reason: 'no-active-quest' };
          const lm = s.landmarks.find((l) => l.id === quest.landmarkId);
          const partySize = active.soloVersion ? 1 : partySizeOf(s.party);
          const outcome = applyCompletion(s.progress, { quest, landmarkName: lm?.name ?? 'Unknown place', partySize });
          if (outcome.duplicate || !outcome.reward) {
            set({ activeQuest: null });
            return { ok: false, reason: 'duplicate' };
          }
          set({ progress: outcome.progress, activeQuest: null, lastReward: outcome.reward });
          if (s.party) partyService.setQuest(null);
          return { ok: true, reward: outcome.reward };
        },

        clearLastReward: () => set({ lastReward: null }),

        connectParty: () => partyService.connect(),
        createParty: () => partyService.createParty(selfInfo(), get().activeQuest?.questId ?? null),
        joinHostedParty: (hostId) => partyService.joinHostedParty(selfInfo(), hostId),
        invitePlayer: (id) => partyService.invite(id),
        leaveParty: () => partyService.leaveParty(),
        setReady: (ready) => partyService.setReady(ready),
        sendChat: (text) => partyService.sendMessage(text),

        resetDemo: async () => {
          partyService.leaveParty();
          await clearCache();
          worldRequestId++;
          const fresh = initialPersisted();
          set({ ...fresh, ...initialTransient, hydrated: true, connection: get().connection, nearbyPlayers: get().nearbyPlayers, settings: { ...fresh.settings, onboarded: false } });
          const region = regionById(fresh.regionId)!;
          await loadWorld(region.center, 'region', fresh.regionId);
        },
      };
    },
    {
      name: 'thaw-game-v1',
      version: 1,
      storage: zustandStorage,
      partialize: (s): PersistedState => ({
        player: s.player,
        progress: s.progress,
        settings: s.settings,
        locationMode: s.locationMode,
        regionId: s.regionId,
        manualCenter: s.manualCenter,
        worldCenter: s.worldCenter,
        landmarks: s.landmarks,
        quests: s.quests,
        questSource: s.questSource,
        activeQuest: s.activeQuest,
        seenQuestIds: s.seenQuestIds,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

// Mirror the party service into the store (single subscription, app lifetime).
partyService.subscribe((snap: PartySnapshot) => {
  useGameStore.setState({ connection: snap.connection, party: snap.party, chat: snap.messages, nearbyPlayers: snap.nearby });
});
