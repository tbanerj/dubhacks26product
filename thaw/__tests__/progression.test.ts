import {
  applyCompletion,
  collectibleIdFor,
  currentStreak,
  dailyXp,
  FIRST_VISIT_BONUS,
  levelForXp,
  levelProgress,
  nextStreak,
  partyBonus,
  pruneXpByDay,
  xpToReachLevel,
} from '../src/game/progression';
import { dayDiff, localDayKey, shiftDayKey } from '../src/game/dates';
import type { Progress, Quest } from '../src/types';

const emptyProgress = (): Progress => ({
  totalXp: 0,
  xpByDay: {},
  streak: 0,
  lastActiveDay: null,
  completions: [],
  visitedLandmarkIds: [],
  collectibles: [],
});

const quest = (over: Partial<Quest> = {}): Quest => ({
  id: 'q1',
  landmarkId: 'lm1',
  title: 'Test Quest',
  description: 'A test quest description',
  instructions: ['Do the thing'],
  soloAlternative: null,
  mode: 'solo',
  minParty: 1,
  maxParty: 1,
  durationMin: 10,
  difficulty: 'easy',
  xp: 60,
  collectible: { theme: 'botanical', rarity: 'common', name: 'Test Leaf' },
  evidence: 'A photo of a leaf',
  safetyNotes: [],
  source: 'local',
  ...over,
});

describe('level thresholds', () => {
  it('uses the documented curve', () => {
    expect([1, 2, 3, 4, 5].map(xpToReachLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('levelForXp is the inverse at and around every threshold', () => {
    for (let L = 1; L <= 40; L++) {
      const x = xpToReachLevel(L);
      expect(levelForXp(x)).toBe(L);
      if (x > 0) expect(levelForXp(x - 1)).toBe(L - 1);
    }
  });

  it('handles negative and fractional XP safely', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(99.9)).toBe(1);
  });

  it('reports progress within a level', () => {
    const lp = levelProgress(150);
    expect(lp).toMatchObject({ level: 2, intoLevel: 50, levelSpan: 200, toNext: 150 });
    expect(lp.fraction).toBeCloseTo(0.25);
  });
});

describe('daily progression', () => {
  it('builds local day keys', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('extends, keeps, or resets streaks', () => {
    expect(nextStreak(0, null, '2026-10-17')).toBe(1);
    expect(nextStreak(3, '2026-10-16', '2026-10-17')).toBe(4);
    expect(nextStreak(3, '2026-10-17', '2026-10-17')).toBe(3);
    expect(nextStreak(3, '2026-10-14', '2026-10-17')).toBe(1);
  });

  it('only shows a live streak if active today or yesterday', () => {
    expect(currentStreak({ streak: 5, lastActiveDay: '2026-10-16' }, '2026-10-17')).toBe(5);
    expect(currentStreak({ streak: 5, lastActiveDay: '2026-10-14' }, '2026-10-17')).toBe(0);
  });

  it('daily XP reads only today and prunes old days', () => {
    expect(dailyXp({ xpByDay: { '2026-10-16': 50, '2026-10-17': 20 } }, '2026-10-17')).toBe(20);
    const pruned = pruneXpByDay({ '2026-01-01': 10, '2026-10-10': 5, '2026-10-17': 1 }, '2026-10-17', 30);
    expect(Object.keys(pruned)).toEqual(['2026-10-10', '2026-10-17']);
  });
});

describe('applyCompletion', () => {
  const now = new Date(2026, 9, 17, 14, 0);

  it('awards XP, first-visit bonus, collectible and history', () => {
    const { progress, reward, duplicate } = applyCompletion(emptyProgress(), { quest: quest(), landmarkName: 'Park', partySize: 1, now });
    expect(duplicate).toBe(false);
    expect(reward?.xpGained).toBe(60 + FIRST_VISIT_BONUS);
    expect(progress.totalXp).toBe(80);
    expect(progress.xpByDay['2026-10-17']).toBe(80);
    expect(progress.streak).toBe(1);
    expect(progress.completions).toHaveLength(1);
    expect(progress.visitedLandmarkIds).toEqual(['lm1']);
    expect(progress.collectibles[0]?.id).toBe(collectibleIdFor(quest()));
    expect(reward?.collectible?.name).toBe('Test Leaf');
  });

  it('awards XP exactly once for the same quest (idempotent)', () => {
    const first = applyCompletion(emptyProgress(), { quest: quest(), landmarkName: 'Park', partySize: 1, now });
    const second = applyCompletion(first.progress, { quest: quest(), landmarkName: 'Park', partySize: 1, now });
    expect(second.duplicate).toBe(true);
    expect(second.reward).toBeNull();
    expect(second.progress).toBe(first.progress);
    expect(second.progress.totalXp).toBe(80);
  });

  it('does not duplicate a collectible already owned, but still grants XP for a new quest', () => {
    const first = applyCompletion(emptyProgress(), { quest: quest(), landmarkName: 'Park', partySize: 1, now });
    const other = quest({ id: 'q2', title: 'Another one' });
    const second = applyCompletion(first.progress, { quest: other, landmarkName: 'Park', partySize: 1, now });
    expect(second.reward?.collectible).toBeNull();
    expect(second.reward?.newLandmark).toBe(false);
    expect(second.reward?.xpGained).toBe(60);
    expect(second.progress.collectibles).toHaveLength(1);
  });

  it('gives solo quests no party bonus even if a party size is sent', () => {
    const { reward } = applyCompletion(emptyProgress(), { quest: quest({ mode: 'solo' }), landmarkName: 'Park', partySize: 4, now });
    expect(reward?.xpGained).toBe(60 + FIRST_VISIT_BONUS);
  });

  it('adds a capped party bonus', () => {
    expect(partyBonus(1)).toBe(0);
    expect(partyBonus(3)).toBe(20);
    expect(partyBonus(10)).toBe(30);
    const { reward } = applyCompletion(emptyProgress(), { quest: quest({ mode: 'party', minParty: 2, maxParty: 4 }), landmarkName: 'Park', partySize: 4, now });
    expect(reward?.xpGained).toBe(60 + 30 + FIRST_VISIT_BONUS);
  });

  it('reports level-ups', () => {
    const p = { ...emptyProgress(), totalXp: 90 };
    const { reward } = applyCompletion(p, { quest: quest(), landmarkName: 'Park', partySize: 1, now });
    expect(reward?.levelBefore).toBe(1);
    expect(reward?.levelAfter).toBe(2);
  });
});
