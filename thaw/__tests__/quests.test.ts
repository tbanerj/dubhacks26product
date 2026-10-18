import { findUnsafeContent, validateQuest } from '../src/game/questSchema';
import { demoQuestsForLandmark, generateLocalQuests, withDemoQuests } from '../src/game/localQuests';
import { DEMO_REGIONS, sampleSpotsAround, seededLandmarks } from '../src/data/regions';
import type { Landmark, LandmarkCategory } from '../src/types';

const lm: Landmark = { id: 'lm1', name: 'Test Park', category: 'park', coordinate: { latitude: 1, longitude: 2 }, source: 'seed' };
const byId = new Map([[lm.id, lm]]);

const valid = {
  landmarkId: 'lm1',
  title: 'Leaf Hunt',
  description: 'Find three kinds of leaves in the park.',
  instructions: ['Walk the main path.', 'Photograph three leaves.'],
  mode: 'solo',
  durationMin: 15,
  difficulty: 'easy',
  xp: 60,
  collectible: { theme: 'botanical', rarity: 'common', name: 'Park Leaf' },
  evidence: 'A photo of three leaves.',
};

describe('validateQuest', () => {
  it('accepts a well-formed quest and normalises it', () => {
    const r = validateQuest(valid, byId, 'gemini');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quest.minParty).toBe(1);
      expect(r.quest.maxParty).toBe(1);
      expect(r.quest.safetyNotes).toContain('Stay in public, well-lit areas.');
      expect(r.quest.id).toMatch(/^q-gemini-lm1-/);
    }
  });

  it('produces stable ids for the same content', () => {
    const a = validateQuest(valid, byId, 'local');
    const b = validateQuest(valid, byId, 'local');
    expect(a.ok && b.ok && a.quest.id === b.quest.id).toBe(true);
  });

  it.each([
    ['missing fields', { title: 'x' }],
    ['not an object', 'quest!'],
    ['null', null],
    ['bad enum', { ...valid, mode: 'raid' }],
    ['xp out of range', { ...valid, xp: 100000 }],
    ['too many instructions', { ...valid, instructions: ['a1a', 'b2b', 'c3c', 'd4d', 'e5e', 'f6f'] }],
  ])('rejects invalid output: %s', (_, raw) => {
    expect(validateQuest(raw, byId, 'gemini').ok).toBe(false);
  });

  it('rejects quests for landmarks it does not know', () => {
    const r = validateQuest({ ...valid, landmarkId: 'nope' }, byId, 'gemini');
    expect(r).toMatchObject({ ok: false });
  });

  it.each([
    'Climb the fence to reach the roof garden',
    'Ask a stranger for their phone number',
    'Buy a coffee from the stall',
    'Take a selfie with a stranger',
    'Explore the abandoned warehouse behind the park',
    'Meet at midnight by the gate',
  ])('rejects unsafe instruction: %s', (bad) => {
    const r = validateQuest({ ...valid, instructions: [bad] }, byId, 'gemini');
    expect(r.ok).toBe(false);
  });

  it('requires a solo alternative for social and party quests', () => {
    expect(validateQuest({ ...valid, mode: 'social' }, byId, 'gemini').ok).toBe(false);
    const ok = validateQuest({ ...valid, mode: 'party', soloAlternative: 'Do it alone with four details.', minParty: 1 }, byId, 'gemini');
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.quest.minParty).toBe(2);
  });

  it('does not flag harmless phrasing', () => {
    expect(findUnsafeContent(['In order to see the view, stand by the railing.', 'Pay attention to the colours.'])).toBeNull();
  });
});

describe('generateLocalQuests', () => {
  const categories: LandmarkCategory[] = ['park', 'garden', 'library', 'market', 'artwork', 'museum', 'historic', 'viewpoint', 'plaza', 'fountain', 'shrine', 'custom'];

  it('produces valid quests for every category, solo first', () => {
    for (const category of categories) {
      for (let i = 0; i < 6; i++) {
        const place: Landmark = { ...lm, id: `${category}-${i}`, name: `Place ${i}`, category };
        const quests = generateLocalQuests([place], { now: new Date(2026, 9, 17, 13) });
        expect(quests.length).toBe(2);
        expect(quests[0]?.mode).toBe('solo');
        expect(quests.every((q) => q.landmarkId === place.id)).toBe(true);
      }
    }
  });

  it('is deterministic', () => {
    const lms = seededLandmarks('tokyo');
    const a = generateLocalQuests(lms, { now: new Date(2026, 9, 17, 13) }).map((q) => q.id);
    const b = generateLocalQuests(lms, { now: new Date(2026, 9, 17, 13) }).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it('avoids daylight party quests at night', () => {
    const night = generateLocalQuests(seededLandmarks('london'), { now: new Date(2026, 9, 17, 23) });
    expect(night.some((q) => q.mode === 'party')).toBe(false);
    expect(night.every((q) => q.safetyNotes.some((n) => /daylight/i.test(n)))).toBe(true);
  });

  it('works for every demo region and for sample spots anywhere (Unicode names too)', () => {
    for (const r of DEMO_REGIONS) {
      const lms = r.id === 'anywhere' ? sampleSpotsAround(r.center) : seededLandmarks(r.id);
      expect(lms.length).toBeGreaterThanOrEqual(5);
      expect(generateLocalQuests(lms).length).toBe(lms.length * 2);
    }
    const unicode: Landmark = { ...lm, id: 'u1', name: '代々木公園 🌳 Ōkubo', category: 'park' };
    expect(generateLocalQuests([unicode])[0]?.collectible.name.length).toBeGreaterThan(0);
  });

  it('adds three easy (demo) quests on the nearest landmark', () => {
    const near: Landmark = { ...lm, id: 'near', coordinate: { latitude: 47.65, longitude: -122.31 } };
    const far: Landmark = { ...lm, id: 'far', coordinate: { latitude: 47.7, longitude: -122.2 } };
    const demos = demoQuestsForLandmark(near);
    expect(demos.map((q) => q.title)).toEqual(['Find a Book (demo)', 'Read a Sign (demo)', 'Spot a Seat (demo)']);
    expect(demos.every((q) => q.title.endsWith(' (demo)') && q.mode === 'solo' && q.difficulty === 'easy' && q.durationMin === 5)).toBe(true);

    const merged = withDemoQuests([far, near], [], near.coordinate);
    expect(merged).toHaveLength(3);
    expect(merged.every((q) => q.landmarkId === 'near')).toBe(true);
    expect(withDemoQuests([near], demos, near.coordinate)).toHaveLength(3);
  });
});
