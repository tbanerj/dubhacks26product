/**
 * Single typed source of truth. Game rules live in `src/game/*`; this store only
 * orchestrates services and applies results.
 *
 * Modes
 *  - Real (default): signed-in account, real GPS, OpenStreetMap places, in-app Gemini
 *    photo checks, real parties, global leaderboards. Rewards are recorded by
 *    `complete_quest` after Gemini accepts the photo.
 *  - Demo location (You tab): the player stands in a chosen city instead of using GPS.
 *    Quests, photos, parties, leaderboards, and the signed-in account stay live.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatMessage,
  CollectibleTheme,
  ConnectionState,
  Landmark,
  LatLng,
  LocationMode,
  NearbyPlayer,
  OwnedCollectible,
  Party,
  PlayerProfile,
  Progress,
  Quest,
  Rarity,
  RewardSummary,
  VerificationResult,
} from '../types';
import { zustandStorage, clearCache } from '../services/storage';
import { DEMO_REGIONS, GENERIC_REGION_ID, nearestRegion, regionById, sampleSpotsAround, seededLandmarks } from '../data/regions';
import { localDayKey, shiftDayKey } from '../game/dates';
import { applyCompletion, levelForXp } from '../game/progression';
import { CHECK_IN_RADIUS_M, distanceMeters, isValidCoordinate, offsetMeters } from '../game/geo';
import { generateLocalQuests, withDemoQuests } from '../game/localQuests';
import type { ActiveQuest } from '../game/questStatus';
import { discoverPlaces } from '../services/places';
import { generateQuests } from '../services/gemini';
import * as LocationService from '../services/location';
import { SimulatedPartyService, type PartyService, type PartySnapshot } from '../services/photon';
import { SupabasePartyService } from '../services/supabaseParty';
import { deviceUnitSystem, clampText, deviceLocale, type UnitSystem } from '../utils/format';
import { supabase } from '../services/supabase/client';
import * as Auth from '../services/auth';
import { completeCloudOnboarding, fetchCloudSnapshot, submitCompletion, updateCloudProfile, type ServerReward } from '../services/cloud';
import type { AppearancePreference } from '../theme/tokens';

export type { AppearancePreference };
export type WorldStatus = 'idle' | 'loading' | 'ready' | 'needs-location' | 'error';

export interface Settings {
  units: UnitSystem;
  preferSolo: boolean;
  mobilityFriendly: boolean;
  /** Opt-in location stand-in. Off by default so a signed-in player uses real GPS. */
  demoMode: boolean;
  /** System, light, or dark. Stays on this device. */
  appearance: AppearancePreference;
}

export interface Account {
  userId: string;
  email: string | null;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline';
export type OnboardingState = 'unknown' | 'needed' | 'done';

interface PersistedState {
  /** Which account the cached data below belongs to. */
  cacheOwner: string | null;
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
  /** The inactive progress: real progress while in demo mode, demo progress while not. */
  stashedProgress: Progress | null;
  lastChatReadAt: string | null;
  seenCollectibleIds: string[];
}

interface TransientState {
  hydrated: boolean;
  gpsPosition: LatLng | null;
  simulatedPosition: LatLng | null;
  permission: LocationService.PermissionState;
  worldStatus: WorldStatus;
  worldNote: string | null;
  lastReward: (RewardSummary & { source: 'server' | 'demo' }) | null;
  connection: ConnectionState;
  party: Party | null;
  chat: ChatMessage[];
  nearbyPlayers: NearbyPlayer[];
  partyError: string | null;
  account: Account | null;
  authReady: boolean;
  onboarding: OnboardingState;
  syncState: SyncState;
  pendingEvidenceUri: string | null;
}

export type AcceptResult = { ok: true } | { ok: false; reason: 'needs-party' | 'unknown-quest' | 'already-completed' };
export type CompleteResult =
  | { ok: true; reward: RewardSummary }
  | { ok: false; reason: 'no-active-quest' | 'not-accepted' | 'duplicate' | 'not-demo' | 'rate-limited' | 'daily-limit' | 'network' | 'invalid' | 'auth' };

interface Actions {
  markHydrated(): void;
  setPlayerName(name: string): void;
  setAvatarHue(hue: number): void;
  updateSettings(patch: Partial<Omit<Settings, 'demoMode'>>): void;
  setDemoMode(on: boolean): Promise<void>;

  enableGps(): Promise<{ ok: boolean; reason?: string }>;
  refreshGps(): Promise<void>;
  setRegion(regionId: string): Promise<void>;
  setManualCenter(center: LatLng): Promise<void>;
  reloadWorld(): Promise<void>;
  startWorld(): Promise<void>;

  markSeen(questIds: string[]): void;
  acceptQuest(questId: string, opts?: { solo?: boolean }): AcceptResult;
  abandonQuest(): void;
  simulateWalkTo(landmarkId: string): void;
  clearSimulatedPosition(): void;
  checkIn(): { ok: boolean; distanceM: number | null };
  /** Local reward when Gemini is not checking the photo. */
  completeActiveQuest(verification: VerificationResult): CompleteResult;
  /** Signed-in play: Gemini already accepted; record the reward on the server. */
  recordLiveReward(verification: VerificationResult): Promise<CompleteResult>;
  clearLastReward(): void;
  setPendingEvidenceUri(uri: string | null): void;
  markChatRead(): void;
  markCollectiblesSeen(): void;

  connectParty(): void;
  createParty(): void;
  joinPartyByCode(code: string): Promise<boolean>;
  joinHostedParty(hostId: string): void;
  invitePlayer(playerId: string): void;
  leaveParty(): void;
  setReady(ready: boolean): void;
  setPartyQuest(questId: string | null, questTitle: string | null): void;
  sendChat(text: string): void;

  initAuth(): () => void;
  pullCloud(): Promise<void>;
  completeOnboarding(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<{ ok: boolean; error?: string }>;
  resetDemo(): Promise<void>;
}

export type GameState = PersistedState & TransientState & Actions;

export function emptyProgress(): Progress {
  return { totalXp: 0, xpByDay: {}, streak: 0, lastActiveDay: null, completions: [], visitedLandmarkIds: [], collectibles: [] };
}

/** Legacy demo starting score. New demo sessions keep the signed-in progress instead. */
export function demoSeedProgress(now = new Date()): Progress {
  const yesterday = shiftDayKey(localDayKey(now), -1);
  const at = new Date(now.getTime() - 86_400_000).toISOString();
  return {
    totalXp: 140,
    xpByDay: { [yesterday]: 140 },
    streak: 1,
    lastActiveDay: yesterday,
    completions: [
      { questId: 'demo-first-steps', landmarkId: 'demo-home', landmarkName: 'Demo walk', questTitle: 'First Steps', xp: 140, completedAt: at, dayKey: yesterday, collectibleId: 'pin:demo-home:neighborhood', partySize: 1 },
    ],
    visitedLandmarkIds: ['demo-home'],
    collectibles: [{ id: 'pin:demo-home:neighborhood', name: 'First Steps Doorway', theme: 'neighborhood', rarity: 'common', landmarkName: 'Demo walk', unlockedAt: at }],
  };
}

const DEFAULT_PLAYER: PlayerProfile = { id: 'me', name: 'Explorer', avatarHue: 28, homeRegionId: null };

function initialPersisted(): PersistedState {
  return {
    cacheOwner: null,
    player: { ...DEFAULT_PLAYER },
    progress: emptyProgress(),
    settings: { units: deviceUnitSystem(), preferSolo: false, mobilityFriendly: false, demoMode: false, appearance: 'system' },
    locationMode: 'gps',
    regionId: 'seattle',
    manualCenter: null,
    worldCenter: null,
    landmarks: [],
    quests: [],
    questSource: 'local',
    activeQuest: null,
    seenQuestIds: [],
    stashedProgress: null,
    lastChatReadAt: null,
    seenCollectibleIds: [],
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
  partyError: null,
  account: null,
  authReady: false,
  onboarding: 'unknown',
  syncState: 'idle',
  pendingEvidenceUri: null,
};

const WORLD_RESET = {
  landmarks: [] as Landmark[],
  quests: [] as Quest[],
  activeQuest: null,
  worldCenter: null,
  manualCenter: null,
  simulatedPosition: null,
  worldStatus: 'idle' as WorldStatus,
  worldNote: null,
};

export type PositionKind = 'gps' | 'simulated' | 'sample' | 'manual' | 'none';

/**
 * Where the map and quest list are centered. A chosen city or a long-pressed
 * point wins over GPS so browsing another area actually moves the game.
 * Simulated walking stays in Demo mode. Live check-in still uses real GPS.
 */
export function playerPosition(
  s: Pick<GameState, 'gpsPosition' | 'simulatedPosition' | 'locationMode' | 'regionId' | 'manualCenter'> & {
    worldCenter?: LatLng | null;
    settings?: Pick<Settings, 'demoMode'>;
  },
): { coordinate: LatLng; kind: PositionKind } {
  const demo = s.settings?.demoMode ?? false;
  if (demo && s.simulatedPosition) return { coordinate: s.simulatedPosition, kind: 'simulated' };
  if (s.locationMode === 'manual' && s.manualCenter) return { coordinate: s.manualCenter, kind: 'manual' };
  if (s.locationMode === 'region') {
    if (s.regionId === GENERIC_REGION_ID && s.worldCenter && isValidCoordinate(s.worldCenter)) {
      return { coordinate: s.worldCenter, kind: 'sample' };
    }
    const region = regionById(s.regionId) ?? DEMO_REGIONS[0]!;
    return { coordinate: region.center, kind: 'sample' };
  }
  if (s.gpsPosition) return { coordinate: s.gpsPosition, kind: 'gps' };
  if (!demo) return { coordinate: { latitude: 0, longitude: 0 }, kind: 'none' };
  const region = regionById(s.regionId) ?? DEMO_REGIONS[0]!;
  return { coordinate: region.center, kind: 'sample' };
}

export function partySizeOf(party: Party | null): number {
  return party ? party.members.length : 1;
}

const THEMES: readonly CollectibleTheme[] = ['botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood'];
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

let worldRequestId = 0;
const simulatedParty = new SimulatedPartyService();
const realParty = new SupabasePartyService();
let activeParty: PartyService = realParty;
let partyUnsub: (() => void) | null = null;

function mirrorReward(progress: Progress, reward: ServerReward): RewardSummary {
  const collectible: OwnedCollectible | null = reward.collectible
    ? {
        id: reward.collectible.id,
        name: reward.collectible.name,
        theme: (THEMES as readonly string[]).includes(reward.collectible.theme) ? (reward.collectible.theme as CollectibleTheme) : 'neighborhood',
        rarity: (RARITIES as readonly string[]).includes(reward.collectible.rarity) ? (reward.collectible.rarity as Rarity) : 'common',
        landmarkName: reward.collectible.landmark_name,
        unlockedAt: reward.collectible.unlocked_at,
      }
    : null;
  return {
    xpGained: reward.xp_gained,
    levelBefore: levelForXp(progress.totalXp),
    levelAfter: levelForXp(reward.total_xp),
    collectible,
    newLandmark: reward.new_landmark,
    streak: reward.streak,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      const bindParty = (svc: PartyService) => {
        partyUnsub?.();
        activeParty = svc;
        partyUnsub = svc.subscribe((snap: PartySnapshot) =>
          set({ connection: snap.connection, party: snap.party, chat: snap.messages, nearbyPlayers: snap.nearby, partyError: svc.error() }),
        );
      };

      const loadWorld = async (center: LatLng, mode: LocationMode, regionId: string, force = false): Promise<void> => {
        const requestId = ++worldRequestId;
        set({ worldStatus: 'loading', worldNote: null });
        const region = regionById(regionId);

        let landmarks: Landmark[] = [];
        let note: string | null = null;

        const curated = (): { landmarks: Landmark[]; note: string } => {
          const backupId = mode === 'region' && regionId !== GENERIC_REGION_ID ? regionId : nearestRegion(center)?.id;
          const backup = backupId ? seededLandmarks(backupId) : [];
          if (backup.length > 0) return { landmarks: backup, note: 'Live map data is unavailable. Showing saved public places nearby.' };
          return { landmarks: sampleSpotsAround(center), note: 'Live map data is unavailable. Showing sample spots so you can still play.' };
        };

        if (mode === 'region' && regionId === GENERIC_REGION_ID) {
          landmarks = sampleSpotsAround(center);
          note = 'Sample spots around this point, not live map data.';
        } else {
          const res = await discoverPlaces(center, 1_500, { force });
          if (requestId !== worldRequestId) return;
          if (res.ok && res.landmarks.length > 0) {
            landmarks = res.landmarks;
            if (res.cached) note = 'Showing saved places from your last visit.';
          } else {
            const fallback = curated();
            landmarks = fallback.landmarks;
            note = res.ok ? 'No mapped public places within 1.5 km yet. Showing saved spots nearby.' : fallback.note;
          }
        }

        const prev = get();
        const active = prev.activeQuest ? prev.quests.find((q) => q.id === prev.activeQuest?.questId) : undefined;
        const activeLandmark = active ? prev.landmarks.find((l) => l.id === active.landmarkId) : undefined;
        if (activeLandmark && !landmarks.some((l) => l.id === activeLandmark.id)) landmarks = [activeLandmark, ...landmarks];

        try {
          const batch = await generateQuests({
            landmarks,
            playerPosition: center,
            localeHint: (mode === 'region' ? region?.localeHint : null) ?? deviceLocale(),
            regionName: mode === 'region' ? (region?.name ?? null) : null,
            partySize: partySizeOf(prev.party),
            preferSolo: prev.settings.preferSolo,
            mobilityFriendly: prev.settings.mobilityFriendly,
          });
          if (requestId !== worldRequestId) return;
          let quests = withDemoQuests(landmarks, batch.quests, center);
          if (active && !quests.some((q) => q.id === active.id)) quests = [active, ...quests];

          set({
            worldCenter: center,
            landmarks,
            quests,
            questSource: batch.source,
            worldStatus: 'ready',
            worldNote: [note, batch.note].filter(Boolean).join(' ') || null,
          });
        } catch (e) {
          if (requestId !== worldRequestId) return;
          const reason = e instanceof Error ? e.message : 'Couldn’t refresh this area.';
          set({
            worldCenter: center,
            landmarks,
            quests: withDemoQuests(landmarks, generateLocalQuests(landmarks), center),
            questSource: 'local',
            worldStatus: 'ready',
            worldNote: `${reason} Showing built-in quests instead.`,
          });
        }
      };

      const selfInfo = () => {
        const s = get();
        return { id: s.player.id, name: s.player.name, avatarHue: s.player.avatarHue, level: levelForXp(s.progress.totalXp) };
      };

      const clearAccountData = () => {
        worldRequestId++;
        realParty.disconnect();
        simulatedParty.disconnect();
        set({ ...initialPersisted(), ...initialTransient, hydrated: true, authReady: true });
        bindParty(realParty);
      };

      return {
        ...initialPersisted(),
        ...initialTransient,

        markHydrated: () => {
          set({ hydrated: true });
          bindParty(realParty);
        },

        setPlayerName: (name) => {
          const clean = clampText(name.replace(/[\u0000-\u001F]/g, ''), 24);
          if (!clean) return;
          set((s) => ({ player: { ...s.player, name: clean } }));
          const acct = get().account;
          if (acct) void updateCloudProfile(acct.userId, { displayName: clean });
        },
        setAvatarHue: (hue) => {
          const h = ((Math.round(hue) % 360) + 360) % 360;
          set((s) => ({ player: { ...s.player, avatarHue: h } }));
          const acct = get().account;
          if (acct) void updateCloudProfile(acct.userId, { avatarHue: h });
        },
        updateSettings: (patch) => {
          const before = get().settings;
          set((s) => ({ settings: { ...s.settings, ...patch, appearance: patch.appearance ?? s.settings.appearance ?? 'system' } }));
          if (
            (patch.preferSolo !== undefined && patch.preferSolo !== before.preferSolo) ||
            (patch.mobilityFriendly !== undefined && patch.mobilityFriendly !== before.mobilityFriendly)
          ) {
            void get().reloadWorld();
          }
        },

        setDemoMode: async (on) => {
          const s = get();
          if (s.settings.demoMode === on) return;
          worldRequestId++;
          set({
            settings: { ...s.settings, demoMode: on },
            ...WORLD_RESET,
            locationMode: on ? 'region' : 'gps',
            regionId: on ? 'seattle' : s.regionId,
            simulatedPosition: null,
            lastReward: null,
            pendingEvidenceUri: null,
          });
          await get().startWorld();
        },

        startWorld: async () => {
          const s = get();
          if (s.settings.demoMode) {
            await get().setRegion(s.regionId || 'seattle');
            return;
          }
          const perm = await LocationService.getPermissionState();
          set({ permission: perm });
          if (perm === 'granted') {
            const res = await get().enableGps();
            if (!res.ok) set({ worldStatus: 'needs-location', worldNote: res.reason ?? null });
          } else {
            set({ worldStatus: 'needs-location' });
          }
        },

        enableGps: async () => {
          if (get().settings.demoMode) {
            await get().setDemoMode(false);
            return { ok: get().locationMode === 'gps' };
          }
          const perm = await LocationService.requestPermission();
          set({ permission: perm });
          if (perm !== 'granted') {
            if (!get().settings.demoMode) set({ worldStatus: 'needs-location' });
            return { ok: false, reason: perm === 'denied' ? 'Location permission was declined.' : 'Location is unavailable on this device.' };
          }
          const fix = await LocationService.getCurrentFix();
          if (!fix.ok) {
            if (!get().settings.demoMode) set({ worldStatus: 'needs-location', worldNote: fix.reason });
            return { ok: false, reason: fix.reason };
          }
          set({ gpsPosition: fix.coordinate, locationMode: 'gps', simulatedPosition: null, manualCenter: null });
          await loadWorld(fix.coordinate, 'gps', get().regionId, true);
          return { ok: true };
        },

        refreshGps: async () => {
          const perm = await LocationService.getPermissionState();
          set({ permission: perm });
          if (perm !== 'granted') return;
          const fix = await LocationService.getCurrentFix();
          if (fix.ok) set({ gpsPosition: fix.coordinate });
        },

        setRegion: async (regionId) => {
          const region = regionById(regionId);
          if (!region) return;
          const s = get();
          const here = s.gpsPosition ?? s.manualCenter ?? s.worldCenter;
          const center =
            regionId === GENERIC_REGION_ID && here && isValidCoordinate(here) && (here.latitude !== 0 || here.longitude !== 0) ? here : region.center;
          set({ regionId, locationMode: 'region', simulatedPosition: null, manualCenter: null, worldCenter: center });
          await loadWorld(center, 'region', regionId, true);
        },

        setManualCenter: async (center) => {
          if (!isValidCoordinate(center)) return;
          set({ manualCenter: center, locationMode: 'manual', simulatedPosition: null, worldCenter: center });
          await loadWorld(center, 'manual', get().regionId, true);
        },

        reloadWorld: async () => {
          const s = get();
          set({ worldStatus: 'loading', worldNote: null });
          if (s.locationMode === 'gps') {
            const perm = await LocationService.getPermissionState();
            set({ permission: perm });
            if (perm === 'granted') {
              const fix = await LocationService.getCurrentFix();
              if (fix.ok) {
                set({ gpsPosition: fix.coordinate });
                await loadWorld(fix.coordinate, 'gps', get().regionId, true);
                return;
              }
            }
            const known = get().gpsPosition;
            if (known) {
              await loadWorld(known, 'gps', get().regionId, true);
              return;
            }
            await get().startWorld();
            return;
          }
          const region = regionById(s.regionId);
          const center =
            s.locationMode === 'manual' && s.manualCenter
              ? s.manualCenter
              : s.regionId === GENERIC_REGION_ID
                ? (s.worldCenter ?? region?.center)
                : region?.center;
          if (!center || !isValidCoordinate(center) || (center.latitude === 0 && center.longitude === 0)) {
            await get().startWorld();
            return;
          }
          await loadWorld(center, s.locationMode, s.regionId, true);
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
          if (s.party && !solo) activeParty.setQuest(questId, quest.title);
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
          // Browsing another city moves the map, but a live reward still requires being there.
          const pos = s.settings.demoMode ? playerPosition(s) : s.gpsPosition ? { coordinate: s.gpsPosition, kind: 'gps' as const } : { coordinate: { latitude: 0, longitude: 0 }, kind: 'none' as const };
          if (pos.kind === 'none') return { ok: false, distanceM: null };
          const d = distanceMeters(pos.coordinate, lm.coordinate);
          if (d > CHECK_IN_RADIUS_M) return { ok: false, distanceM: d };
          set({ activeQuest: { ...active, checkedIn: true } });
          return { ok: true, distanceM: d };
        },

        completeActiveQuest: (verification) => {
          const s = get();
          if (!s.settings.demoMode) return { ok: false, reason: 'not-demo' };
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
          set({ progress: outcome.progress, activeQuest: null, lastReward: { ...outcome.reward, source: 'demo' } });
          if (s.party) activeParty.setQuest(null);
          return { ok: true, reward: outcome.reward };
        },

        recordLiveReward: async (verification) => {
          const s = get();
          if (!s.account) return { ok: false, reason: 'not-demo' };
          const active = s.activeQuest;
          if (!active) return { ok: false, reason: 'no-active-quest' };
          if (!verification.accepted || verification.source !== 'gemini') return { ok: false, reason: 'not-accepted' };
          const quest = s.quests.find((q) => q.id === active.questId);
          if (!quest) return { ok: false, reason: 'no-active-quest' };
          const lm = s.landmarks.find((l) => l.id === quest.landmarkId);
          const res = await submitCompletion({
            quest,
            landmarkName: lm?.name ?? 'Unknown place',
            partySize: partySizeOf(s.party),
            solo: active.soloVersion || quest.mode === 'solo',
          });
          if (get().account?.userId !== s.account.userId) return { ok: false, reason: 'auth' };
          if (!res.ok) {
            if (res.error === 'duplicate') {
              set({ activeQuest: null });
              return { ok: false, reason: 'duplicate' };
            }
            const reason = res.error === 'rate_limited' ? 'rate-limited' : res.error === 'daily_limit' ? 'daily-limit' : res.error === 'invalid' ? 'invalid' : res.error === 'auth' ? 'auth' : 'network';
            return { ok: false, reason };
          }
          const summary = mirrorReward(get().progress, res.reward);
          set({
            activeQuest: null,
            lastReward: { ...summary, source: 'server' },
            progress: {
              ...get().progress,
              totalXp: res.reward.total_xp,
              streak: res.reward.streak,
              collectibles: summary.collectible ? [summary.collectible, ...get().progress.collectibles.filter((c) => c.id !== summary.collectible?.id)] : get().progress.collectibles,
            },
          });
          if (get().party) activeParty.setQuest(null);
          void get().pullCloud();
          return { ok: true, reward: summary };
        },

        clearLastReward: () => set({ lastReward: null, pendingEvidenceUri: null }),
        setPendingEvidenceUri: (uri) => set({ pendingEvidenceUri: uri }),
        markChatRead: () => {
          const latest = [...get().chat].reverse().find((m) => !m.system)?.at ?? new Date().toISOString();
          set({ lastChatReadAt: latest });
        },
        markCollectiblesSeen: () => set({ seenCollectibleIds: get().progress.collectibles.map((c) => c.id) }),

        connectParty: () => activeParty.connect(),
        createParty: () => activeParty.createParty(selfInfo(), get().activeQuest?.questId ?? null),
        joinPartyByCode: (code) => activeParty.joinByCode(code),
        joinHostedParty: (hostId) => activeParty.joinHostedParty(selfInfo(), hostId),
        invitePlayer: (id) => activeParty.invite(id),
        leaveParty: () => activeParty.leaveParty(),
        setReady: (ready) => activeParty.setReady(ready),
        setPartyQuest: (questId, questTitle) => activeParty.setQuest(questId, questTitle),
        sendChat: (text) => activeParty.sendMessage(text),

        initAuth: () => {
          if (!supabase) {
            set({ authReady: true, onboarding: 'done' });
            return () => undefined;
          }
          const client = supabase;
          const onSession = (user: { id: string; email?: string | null } | null) => {
            const s = get();
            if (!user) {
              if (s.account || s.cacheOwner) clearAccountData();
              set({ authReady: true, account: null });
              return;
            }
            if (s.account?.userId === user.id) {
              set({ authReady: true });
              return;
            }
            if (s.cacheOwner && s.cacheOwner !== user.id) clearAccountData();
            set({
              account: { userId: user.id, email: user.email ?? null },
              cacheOwner: user.id,
              player: { ...get().player, id: user.id },
              authReady: true,
              onboarding: 'unknown',
            });
            get().connectParty();
            void get().pullCloud();
          };
          void client.auth.getSession().then(({ data }) => onSession(data.session?.user ?? null));
          const { data } = client.auth.onAuthStateChange((_event, session) => {
            setTimeout(() => onSession(session?.user ?? null), 0);
          });
          return () => data.subscription.unsubscribe();
        },

        pullCloud: async () => {
          const acct = get().account;
          if (!acct) return;
          set({ syncState: 'syncing' });
          const res = await fetchCloudSnapshot(acct.userId);
          if (get().account?.userId !== acct.userId) return;
          if (!res.ok) {
            set({ syncState: 'offline', onboarding: get().onboarding === 'unknown' ? 'done' : get().onboarding });
            return;
          }
          const s = get();
          set({
            progress: res.data.progress,
            player: { ...s.player, id: acct.userId, name: res.data.profile.displayName, avatarHue: res.data.profile.avatarHue },
            onboarding: res.data.profile.onboarded ? 'done' : 'needed',
            syncState: 'synced',
          });
        },

        completeOnboarding: async () => {
          const acct = get().account;
          set({ onboarding: 'done' });
          if (acct) await completeCloudOnboarding(acct.userId);
        },

        signOut: async () => {
          await Auth.signOut();
          clearAccountData();
        },

        deleteAccount: async () => {
          const res = await Auth.deleteAccount();
          if (!res.ok) return { ok: false, error: res.error };
          clearAccountData();
          return { ok: true };
        },

        resetDemo: async () => {
          if (!get().settings.demoMode) return;
          await clearCache();
          worldRequestId++;
          set({
            ...WORLD_RESET,
            simulatedPosition: null,
            lastReward: null,
            pendingEvidenceUri: null,
            regionId: 'seattle',
            locationMode: 'region',
          });
          await get().setRegion('seattle');
        },
      };
    },
    {
      name: 'thaw-game-v3',
      version: 3,
      storage: zustandStorage,
      partialize: (s): PersistedState => ({
        cacheOwner: s.cacheOwner,
        player: s.player,
        progress: s.progress,
        settings: { ...s.settings, appearance: s.settings.appearance ?? 'system' },
        locationMode: s.locationMode,
        regionId: s.regionId,
        manualCenter: s.manualCenter,
        worldCenter: s.worldCenter,
        landmarks: s.landmarks,
        quests: s.quests,
        questSource: s.questSource,
        activeQuest: s.activeQuest,
        seenQuestIds: s.seenQuestIds,
        stashedProgress: s.stashedProgress,
        lastChatReadAt: s.lastChatReadAt,
        seenCollectibleIds: s.seenCollectibleIds,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
