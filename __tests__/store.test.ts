/**
 * Store behaviour: real mode has no mock data and never grants rewards locally;
 * Demo mode is an isolated sandbox whose XP can't leak into the account.
 */
import { useGameStore, playerPosition } from '../src/store/useGameStore';
import type { VerificationResult } from '../src/types';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ status: 'denied' }),
  requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
  hasServicesEnabledAsync: async () => true,
  getCurrentPositionAsync: async () => null,
  getLastKnownPositionAsync: async () => null,
  watchPositionAsync: async () => ({ remove: () => undefined }),
}));

const accepted: VerificationResult = { accepted: true, confidence: 1, feedback: 'ok', observations: null, source: 'demo' };

describe('real mode (default)', () => {
  it('starts with demo mode OFF and no mock progress', () => {
    const s = useGameStore.getState();
    expect(s.settings.demoMode).toBe(false);
    expect(s.progress.totalXp).toBe(0);
    expect(s.progress.completions).toHaveLength(0);
    expect(s.landmarks).toHaveLength(0);
  });

  it('asks for location instead of showing sample places', async () => {
    await useGameStore.getState().startWorld();
    const s = useGameStore.getState();
    expect(s.worldStatus).toBe('needs-location');
    expect(s.landmarks).toHaveLength(0);
    expect(playerPosition(s).kind).toBe('none');
  });

  it('refuses demo-only actions', async () => {
    await useGameStore.getState().setRegion('tokyo');
    expect(useGameStore.getState().landmarks).toHaveLength(0);
    expect(useGameStore.getState().completeActiveQuest(accepted)).toEqual({ ok: false, reason: 'not-demo' });
  });

  it('mirrors a server-granted reward', () => {
    const summary = useGameStore.getState().applyServerReward({
      duplicate: false,
      xp_gained: 110,
      total_xp: 110,
      streak: 1,
      new_landmark: true,
      collectible: { id: 'pin:x:hidden', name: 'Glint', theme: 'hidden', rarity: 'common', landmark_name: 'Plaza', unlocked_at: '2026-10-17T10:00:00Z' },
    });
    expect(summary).toMatchObject({ xpGained: 110, levelBefore: 1, levelAfter: 2 });
    const s = useGameStore.getState();
    expect(s.progress.totalXp).toBe(110);
    expect(s.lastReward?.source).toBe('server');
    expect(s.progress.collectibles[0]?.id).toBe('pin:x:hidden');
  });
});

describe('demo mode sandbox', () => {
  it('switches to an isolated sandbox with sample cities', async () => {
    await useGameStore.getState().setDemoMode(true);
    const s = useGameStore.getState();
    expect(s.settings.demoMode).toBe(true);
    expect(s.progress.totalXp).toBe(140); // demo seed, not the real 110
    expect(s.landmarks.length).toBeGreaterThan(3);
    expect(s.stashedProgress?.totalXp).toBe(110);
  });

  it('plays the full loop locally and grants XP exactly once', () => {
    const s0 = useGameStore.getState();
    const quest = s0.quests.find((q) => q.mode === 'solo')!;
    expect(s0.acceptQuest(quest.id)).toEqual({ ok: true });
    useGameStore.getState().simulateWalkTo(quest.landmarkId);
    return useGameStore
      .getState()
      .checkIn()
      .then((r) => {
        expect(r.ok).toBe(true);
        const before = useGameStore.getState().progress.totalXp;
        expect(useGameStore.getState().completeActiveQuest(accepted).ok).toBe(true);
        expect(useGameStore.getState().progress.totalXp).toBeGreaterThan(before);
        expect(useGameStore.getState().acceptQuest(quest.id)).toEqual({ ok: false, reason: 'already-completed' });
      });
  });

  it('blocks party quests without a party but allows the solo version', () => {
    const s = useGameStore.getState();
    const party = s.quests.find((q) => q.mode === 'party' && !s.progress.completions.some((c) => c.questId === q.id));
    if (!party) return;
    expect(s.acceptQuest(party.id)).toEqual({ ok: false, reason: 'needs-party' });
    expect(s.acceptQuest(party.id, { solo: true })).toEqual({ ok: true });
    useGameStore.getState().abandonQuest();
  });

  it('turning demo off restores the real account progress untouched', async () => {
    const demoXp = useGameStore.getState().progress.totalXp;
    await useGameStore.getState().setDemoMode(false);
    const s = useGameStore.getState();
    expect(s.settings.demoMode).toBe(false);
    expect(s.progress.totalXp).toBe(110);
    expect(s.stashedProgress?.totalXp).toBe(demoXp);
    expect(s.landmarks).toHaveLength(0); // real mode needs real location
  });
});
