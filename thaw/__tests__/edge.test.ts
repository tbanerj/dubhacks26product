/**
 * Edges around the merged account model: real play cannot use demo shortcuts,
 * and demo XP cannot leak into the signed-in stash.
 */
import { useGameStore } from '../src/store/useGameStore';
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
    });
  });

  it('ignores sample regions, simulated walks, and local rewards', async () => {
    const before = useGameStore.getState().regionId;
    await useGameStore.getState().setRegion('nairobi');
    expect(useGameStore.getState().regionId).toBe(before);
    expect(useGameStore.getState().landmarks).toHaveLength(0);

    useGameStore.getState().simulateWalkTo('anywhere');
    expect(useGameStore.getState().simulatedPosition).toBeNull();

    expect(useGameStore.getState().completeActiveQuest(accepted)).toEqual({ ok: false, reason: 'not-demo' });
    expect(await useGameStore.getState().recordLiveReward({ ...accepted, source: 'gemini' })).toEqual({ ok: false, reason: 'not-demo' });
    expect(useGameStore.getState().checkIn()).toEqual({ ok: false, distanceM: null });
  });

  it('does not reset anything when demo mode is already off', async () => {
    useGameStore.setState({ progress: { ...useGameStore.getState().progress, totalXp: 40 } });
    await useGameStore.getState().resetDemo();
    expect(useGameStore.getState().progress.totalXp).toBe(40);
  });
});

describe('demo mode keeps a separate score', () => {
  it('stashes the real score and restores it when demo mode turns off', async () => {
    useGameStore.setState({
      settings: { ...useGameStore.getState().settings, demoMode: false },
      account: null,
      progress: { totalXp: 500, xpByDay: {}, streak: 2, lastActiveDay: '2026-10-16', completions: [], visitedLandmarkIds: [], collectibles: [] },
      stashedProgress: null,
    });

    await useGameStore.getState().setDemoMode(true);
    const demo = useGameStore.getState();
    expect(demo.settings.demoMode).toBe(true);
    expect(demo.progress.totalXp).toBe(140);
    expect(demo.stashedProgress?.totalXp).toBe(500);
    expect(demo.worldStatus).toBe('ready');

    await useGameStore.getState().setDemoMode(false);
    const real = useGameStore.getState();
    expect(real.settings.demoMode).toBe(false);
    expect(real.progress.totalXp).toBe(500);
    expect(real.progress.totalXp).not.toBe(140);
  });
});
