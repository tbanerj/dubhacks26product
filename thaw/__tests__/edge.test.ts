/**
 * Edges around the account model: real GPS play cannot fake a walk or a reward,
 * and demo mode only swaps the location.
 */
jest.mock('../src/services/places', () => ({
  discoverPlaces: jest.fn(async () => ({ ok: false as const, reason: 'Map data unavailable.' })),
}));

// eslint-disable-next-line import/first
import { playerPosition, useGameStore } from '../src/store/useGameStore';
// eslint-disable-next-line import/first
import type { VerificationResult } from '../src/types';

const accepted: VerificationResult = { accepted: true, confidence: 1, feedback: 'ok', observations: null, source: 'demo' };

describe('real mode refuses demo shortcuts', () => {
  beforeEach(() => {
    useGameStore.setState({
      settings: { ...useGameStore.getState().settings, demoMode: false },
      progress: { totalXp: 0, xpByDay: {}, streak: 0, lastActiveDay: null, completions: [], visitedLandmarkIds: [], collectibles: [] },
      account: null,
      activeQuest: null,
      gpsPosition: null,
      simulatedPosition: null,
      landmarks: [],
      quests: [],
      party: null,
      stashedProgress: null,
      locationMode: 'gps',
      regionId: 'seattle',
      manualCenter: null,
      worldCenter: null,
      worldStatus: 'idle',
      worldNote: null,
    });
  });

  it('browses another region when map data fails, but cannot fake a walk or a reward', async () => {
    await useGameStore.getState().setRegion('nairobi');
    const s = useGameStore.getState();
    expect(s.regionId).toBe('nairobi');
    expect(s.locationMode).toBe('region');
    expect(s.worldStatus).toBe('ready');
    expect(s.landmarks.some((l) => l.id.startsWith('nbo-'))).toBe(true);
    expect(s.quests.length).toBeGreaterThan(0);
    expect(playerPosition(s).kind).toBe('sample');

    useGameStore.setState({ gpsPosition: { latitude: 47.66, longitude: -122.3 } });
    const quest = useGameStore.getState().quests.find((q) => q.mode === 'solo');
    if (!quest) throw new Error('expected a solo quest');
    expect(useGameStore.getState().acceptQuest(quest.id).ok).toBe(true);
    const far = useGameStore.getState().checkIn();
    expect(far.ok).toBe(false);
    if (!far.ok) expect(far.distanceM).toBeGreaterThan(1000);
    useGameStore.getState().abandonQuest();

    const landmarkId = s.landmarks[0]?.id;
    if (!landmarkId) throw new Error('expected a landmark');
    useGameStore.getState().simulateWalkTo(landmarkId);
    expect(useGameStore.getState().simulatedPosition).toBeNull();

    expect(useGameStore.getState().completeActiveQuest(accepted)).toEqual({ ok: false, reason: 'not-demo' });
    expect(await useGameStore.getState().recordLiveReward({ ...accepted, source: 'gemini' })).toEqual({ ok: false, reason: 'not-demo' });
  });

  it('reloads quests around a chosen point when live map data fails', async () => {
    await useGameStore.getState().setManualCenter({ latitude: 47.661, longitude: -122.304 });
    const moved = useGameStore.getState();
    expect(moved.locationMode).toBe('manual');
    expect(moved.worldStatus).toBe('ready');
    expect(moved.landmarks.some((l) => l.id.startsWith('sea-'))).toBe(true);
    expect(moved.quests.length).toBeGreaterThan(0);
    expect(playerPosition(moved).kind).toBe('manual');

    await useGameStore.getState().reloadWorld();
    const refreshed = useGameStore.getState();
    expect(refreshed.locationMode).toBe('manual');
    expect(refreshed.worldStatus).toBe('ready');
    expect(refreshed.quests.length).toBeGreaterThan(0);
  });

  it('does not reset anything when demo mode is already off', async () => {
    useGameStore.setState({ progress: { ...useGameStore.getState().progress, totalXp: 40 } });
    await useGameStore.getState().resetDemo();
    expect(useGameStore.getState().progress.totalXp).toBe(40);
  });
});

describe('demo mode only changes location', () => {
  it('keeps the signed-in score and stands in Seattle', async () => {
    useGameStore.setState({
      settings: { ...useGameStore.getState().settings, demoMode: false },
      account: null,
      progress: { totalXp: 500, xpByDay: {}, streak: 2, lastActiveDay: '2026-10-16', completions: [], visitedLandmarkIds: [], collectibles: [] },
      stashedProgress: null,
      locationMode: 'gps',
    });

    await useGameStore.getState().setDemoMode(true);
    const demo = useGameStore.getState();
    expect(demo.settings.demoMode).toBe(true);
    expect(demo.progress.totalXp).toBe(500);
    expect(demo.locationMode).toBe('region');
    expect(demo.regionId).toBe('seattle');
    expect(demo.worldStatus).toBe('ready');
    expect(demo.landmarks.some((l) => l.id.startsWith('sea-'))).toBe(true);

    await useGameStore.getState().setDemoMode(false);
    const real = useGameStore.getState();
    expect(real.settings.demoMode).toBe(false);
    expect(real.progress.totalXp).toBe(500);
    expect(real.locationMode).toBe('gps');
  });
});
