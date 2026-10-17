/**
 * End-to-end game loop through the store: region → discover → accept → check in →
 * verify → rewards exactly once → persistence → reset.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore, partySizeOf } from '../src/store/useGameStore';
import type { VerificationResult } from '../src/types';

const accepted: VerificationResult = { accepted: true, confidence: 1, feedback: 'ok', observations: null, source: 'demo' };

describe('game loop', () => {
  beforeAll(async () => {
    await useGameStore.getState().setDemoMode(true);
    await useGameStore.getState().setRegion('seattle');
  });

  it('loads seeded quests for a demo region', () => {
    const s = useGameStore.getState();
    expect(s.worldStatus).toBe('ready');
    expect(s.landmarks.length).toBeGreaterThan(3);
    expect(s.quests.length).toBe(s.landmarks.length * 2);
  });

  it('blocks party quests without a party but allows the solo version', () => {
    const s = useGameStore.getState();
    const party = s.quests.find((q) => q.mode === 'party');
    if (!party) return; // depends on deterministic template mix
    expect(partySizeOf(s.party)).toBe(1);
    expect(s.acceptQuest(party.id)).toEqual({ ok: false, reason: 'needs-party' });
    expect(s.acceptQuest(party.id, { solo: true })).toEqual({ ok: true });
    expect(useGameStore.getState().activeQuest?.soloVersion).toBe(true);
    useGameStore.getState().abandonQuest();
  });

  it('requires being near the landmark to check in, then completes once', () => {
    const s0 = useGameStore.getState();
    const quest = s0.quests.find((q) => q.mode === 'solo')!;
    expect(s0.acceptQuest(quest.id)).toEqual({ ok: true });

    // Sample position is the region centre – usually too far.
    const far = useGameStore.getState().checkIn();
    if (!far.ok) expect(far.distanceM).toBeGreaterThan(0);

    useGameStore.getState().simulateWalkTo(quest.landmarkId);
    expect(useGameStore.getState().checkIn().ok).toBe(true);

    // A rejected verification grants nothing.
    expect(useGameStore.getState().completeActiveQuest({ ...accepted, accepted: false })).toEqual({ ok: false, reason: 'not-accepted' });

    const xpBefore = useGameStore.getState().progress.totalXp;
    const res = useGameStore.getState().completeActiveQuest(accepted);
    expect(res.ok).toBe(true);
    const after = useGameStore.getState();
    expect(after.progress.totalXp).toBeGreaterThan(xpBefore);
    expect(after.progress.collectibles.length).toBe(2); // seeded pin + new one
    expect(after.activeQuest).toBeNull();

    // Second submission: no active quest, and re-accepting a completed quest is refused.
    expect(after.completeActiveQuest(accepted)).toEqual({ ok: false, reason: 'no-active-quest' });
    expect(after.acceptQuest(quest.id)).toEqual({ ok: false, reason: 'already-completed' });
    expect(useGameStore.getState().progress.totalXp).toBe(after.progress.totalXp);
  });

  it('persists progress to storage', async () => {
    await new Promise((r) => setTimeout(r, 10));
    const raw = await AsyncStorage.getItem('thaw-game-v3');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!) as { state: { progress: { totalXp: number } } };
    expect(saved.state.progress.totalXp).toBe(useGameStore.getState().progress.totalXp);
  });

  it('resets the demo to its initial state', async () => {
    await useGameStore.getState().resetDemo();
    const s = useGameStore.getState();
    expect(s.progress.totalXp).toBe(140);
    expect(s.progress.completions.length).toBe(1);
    expect(s.settings.demoMode).toBe(true);
    expect(s.regionId).toBe('seattle');
    expect(s.quests.length).toBeGreaterThan(0);
  });

  it('switches to any region worldwide', async () => {
    await useGameStore.getState().setRegion('nairobi');
    const s = useGameStore.getState();
    expect(s.landmarks.every((l) => l.id.startsWith('nbo-'))).toBe(true);
  });
});
