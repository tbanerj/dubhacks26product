/**
 * Single typed source of truth. Game rules live in `src/game/*`; this store only
 * orchestrates services and applies results.
 *
 * Modes
 *  - Real (default): signed-in account, real GPS, OpenStreetMap places, in-app Gemini
 *    photo checks, real parties, global leaderboards. Rewards are recorded by
 *    `complete_quest` after Gemini accepts the photo.
 *  - Demo (Settings): an isolated local sandbox. Demo XP never touches the account
 *    or the global boards.
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
import { DEMO_REGIONS, GENERIC_REGION_ID, regionById, sampleSpotsAround, seededLandmarks } from '../data/regions';
import { localDayKey, shiftDayKey } from '../game/dates';
import { applyCompletion, levelForXp } from '../game/progression';
import { CHECK_IN_RADIUS_M, distanceMeters, isValidCoordinate, offsetMeters } from '../game/geo';
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
  /** Opt-in sandbox. Off by default so a signed-in player uses real GPS and the server. */
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
  /** Demo sandbox only: local reward. */
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

/** Starting point for the Demo sandbox (only ever shown with Demo mode on). */
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
 * Where the player is for game purposes. In real mode this is only real GPS.
 * Simulated, sample, and manual positions exist only in Demo mode.
 */
export function playerPosition(
  s: Pick<GameState, 'gpsPosition' | 'simulatedPosition' | 'locationMode' | 'regionId' | 'manualCenter'> & {
    worldCenter?: LatLng | null;
    settings?: Pick<Settings, 'demoMode'>;
  },
): { coordinate: LatLng; kind: PositionKind } {
  const demo = s.settings?.demoMode ?? false;
  if (!demo) {
    return s.gpsPosition ? { coordinate: s.gpsPosition, kind: 'gps' } : { coordinate: { latitude: 0, longitude: 0 }, kind: 'none' };
  }
  if (s.simulatedPosition) return { coordinate: s.simulatedPosition, kind: 'simulated' };
  if (s.locationMode === 'gps' && s.gpsPosition) return { coordinate: s.gpsPosition, kind: 'gps' };
  if (s.locationMode === 'manual' && s.manualCenter) return { coordinate: s.manualCenter, kind: 'manual' };
  if (s.regionId === GENERIC_REGION_ID && s.worldCenter) return { coordinate: s.worldCenter, kind: 'sample' };
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

      const loadWorld = async (center: LatLng, mode: LocationMode, regionId: string): Promise<void> => {
        const requestId = ++worldRequestId;
        const demo = get().settings.demoMode;
        set({ worldStatus: 'loading', worldNote: null });
        const region = regionById(regionId);

        let landmarks: Landmark[] = [];
        let note: string | null = null;

        if (demo && mode === 'region') {
          landmarks = regionId === GENERIC_REGION_ID ? sampleSpotsAround(center) : seededLandmarks(regionId);
        } else {
          const res = await discoverPlaces(center);
          if (requestId !== worldRequestId) return;
          if (!res.ok) {
            if (demo) {
              landmarks = sampleSpotsAround(center);
              note = `${res.reason} Demo mode is showing sample spots.`;
            } else {
              set({ worldStatus: 'error', worldNote: `${res.reason} Check your connection and try again.` });
              return;
            }
          } else {
            landmarks = res.landmarks;
            if (res.cached) note = 'Showing saved places from your last visit.';
            if (landmarks.length === 0) note = 'No mapped public places within 1.5 km yet. Try a park, library or town square nearby.';
          }
        }

        const prev = get();
        const active = prev.activeQuest ? prev.quests.find((q) => q.id === prev.activeQuest?.questId) : undefined;
        const activeLandmark = active ? prev.landmarks.find((l) => l.id === active.landmarkId) : undefined;
        if (activeLandmark && !landmarks.some((l) => l.id === activeLandmark.id)) landmarks = [activeLandmark, ...landmarks];

        const batch = await generateQuests({
          landmarks,
          playerPosition: center,
          localeHint: (demo ? region?.localeHint : null) ?? deviceLocale(),
          regionName: demo && mode === 'region' ? (region?.name ?? null) : null,
          partySize: partySizeOf(prev.party),
          preferSolo: prev.settings.preferSolo,
          mobilityFriendly: prev.settings.mobilityFriendly,
        });
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
          bindParty(get().settings.demoMode ? simulatedParty : realParty);
        },

        setPlayerName: (name) => {
          const clean = clampText(name.replace(/[\u0000-\u001F]/g, ''), 24);
          if (!clean) return;
          set((s) => ({ player: { ...s.player, name: clean } }));
          const acct = get().account;
          if (acct && !get().settings.demoMode) void updateCloudProfile(acct.userId, { displayName: clean });
        },
        setAvatarHue: (hue) => {
          const h = ((Math.round(hue) % 360) + 360) % 360;
          set((s) => ({ player: { ...s.player, avatarHue: h } }));
          const acct = get().account;
          if (acct && !get().settings.demoMode) void updateCloudProfile(acct.userId, { avatarHue: h });
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
          activeParty.leaveParty();
          const nextProgress = on ? (s.stashedProgress ?? demoSeedProgress()) : (s.stashedProgress ?? emptyProgress());
          set({
            settings: { ...s.settings, demoMode: on },
            stashedProgress: s.progress,
            progress: nextProgress,
            ...WORLD_RESET,
            locationMode: on ? 'region' : 'gps',
            lastReward: null,
            pendingEvidenceUri: null,
          });
          bindParty(on ? simulatedParty : realParty);
          get().connectParty();
          if (!on) void get().pullCloud();
          await get().startWorld();
        },

        startWorld: async () => {
          const s = get();
          if (s.settings.demoMode) {
            if (s.locationMode === 'gps' && s.permission === 'granted') {
              await get().enableGps();
              return;
            }
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
          set({ gpsPosition: fix.coordinate, locationMode: 'gps', simulatedPosition: null });
          await loadWorld(fix.coordinate, 'gps', get().regionId);
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
          if (!get().settings.demoMode) return;
          const region = regionById(regionId);
          if (!region) return;
          const s = get();
          const center = regionId === GENERIC_REGION_ID ? playerPosition({ ...s, simulatedPosition: null }).coordinate : region.center;
          set({ regionId, locationMode: 'region', simulatedPosition: null, manualCenter: null, worldCenter: center });
          await loadWorld(center, 'region', regionId);
        },

        setManualCenter: async (center) => {
          if (!get().settings.demoMode || !isValidCoordinate(center)) return;
          set({ manualCenter: center, locationMode: 'manual', simulatedPosition: null });
          await loadWorld(center, 'manual', get().regionId);
        },

        reloadWorld: async () => {
          const s = get();
          if (!s.settings.demoMode) {
            if (s.gpsPosition) await loadWorld(s.gpsPosition, 'gps', s.regionId);
            else await get().startWorld();
            return;
          }
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
          const pos = playerPosition(s);
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
          if (s.settings.demoMode || !s.account) return { ok: false, reason: 'not-demo' };
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
            ...(s.settings.demoMode ? { stashedProgress: res.data.progress } : { progress: res.data.progress }),
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
          simulatedParty.leaveParty();
          await clearCache();
          worldRequestId++;
          set({
            progress: demoSeedProgress(),
            ...WORLD_RESET,
            seenQuestIds: [],
            seenCollectibleIds: ['pin:demo-home:neighborhood'],
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
