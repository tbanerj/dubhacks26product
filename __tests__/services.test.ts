import { generateQuests } from '../src/services/gemini';
import { verifyEvidence } from '../src/services/perceptron';
import { SimulatedPartyService } from '../src/services/photon';
import { buildLeaderboard } from '../src/game/leaderboard';
import { seededLandmarks } from '../src/data/regions';
import { DEMO_PLAYER_PROFILE } from '../src/data/demoPeople';
import type { Progress, Quest } from '../src/types';

const req = {
  landmarks: seededLandmarks('seattle'),
  playerPosition: { latitude: 47.6553, longitude: -122.3051 },
  localeHint: 'en-US',
  regionName: 'Seattle',
  partySize: 1,
  preferSolo: false,
  mobilityFriendly: false,
  now: new Date(2026, 9, 17, 13),
};

describe('gemini service (no key configured)', () => {
  it('falls back to local quests without any network call', async () => {
    const spy = jest.spyOn(global, 'fetch' as never);
    const batch = await generateQuests(req);
    expect(batch.source).toBe('local');
    expect(batch.quests.length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('respects player preferences', async () => {
    const solo = await generateQuests({ ...req, preferSolo: true });
    expect(solo.quests.every((q) => q.mode === 'solo')).toBe(true);
    const easy = await generateQuests({ ...req, mobilityFriendly: true });
    expect(easy.quests.every((q) => q.difficulty !== 'hard' && q.durationMin <= 25)).toBe(true);
  });
});

describe('gemini service (key configured)', () => {
  const load = () => {
    jest.resetModules();
    jest.doMock('../src/config/env', () => ({
      config: {
        gemini: { apiKey: 'test-key', model: 'gemini-test', endpoint: 'https://example.invalid/models' },
        perceptron: { apiKey: null, baseUrl: '', model: '' },
        photon: { relayUrl: null },
        places: { overpassUrl: '' },
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../src/services/gemini') as typeof import('../src/services/gemini');
  };
  const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) });

  afterEach(() => {
    jest.dontMock('../src/config/env');
  });

  it('uses valid AI quests and fills uncovered landmarks locally', async () => {
    const g = load();
    const aiQuest = {
      landmarkId: 'sea-drumheller',
      title: 'Ripple Reader',
      description: 'Watch how wind writes on the fountain water and capture a ripple.',
      instructions: ['Stand by the fountain edge path.', 'Photograph a ripple pattern.'],
      mode: 'solo',
      durationMin: 10,
      difficulty: 'easy',
      xp: 60,
      collectible: { theme: 'hidden', rarity: 'common', name: 'Ripple Glint' },
      evidence: 'A photo of a ripple on the water.',
    };
    global.fetch = jest.fn().mockResolvedValue(reply({ quests: [aiQuest, { ...aiQuest, title: 'Bad', instructions: ['Climb the fence please'] }] })) as never;
    const batch = await g.generateQuests(req);
    expect(batch.source).toBe('mixed');
    expect(batch.quests.some((q: Quest) => q.source === 'gemini' && q.title === 'Ripple Reader')).toBe(true);
    expect(batch.quests.some((q: Quest) => q.title === 'Bad')).toBe(false);
    expect(batch.note).toMatch(/failed safety or format checks/);
    // Every landmark still has a quest.
    for (const l of req.landmarks) expect(batch.quests.some((q: Quest) => q.landmarkId === l.id)).toBe(true);
  });

  it('falls back on malformed JSON, HTTP errors and network failures', async () => {
    const g = load();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }) }) as never;
    expect((await g.generateQuests(req)).source).toBe('local');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }) as never;
    const b2 = await g.generateQuests(req);
    expect(b2.source).toBe('local');
    expect(b2.note).toMatch(/503/);
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    expect((await g.generateQuests(req)).quests.length).toBeGreaterThan(0);
  });
});

describe('perceptron demo verifier', () => {
  const quest = { title: 'Q', evidence: 'A photo' } as Quest;
  it('is transparent about being simulated and supports a rejection path', async () => {
    jest.useFakeTimers();
    const p1 = verifyEvidence({ quest, landmarkName: 'X', image: { uri: 'file://a.jpg', base64: null, mimeType: 'image/jpeg' } });
    jest.advanceTimersByTime(2000);
    const ok = await p1;
    expect(ok.ok && ok.result.accepted && ok.result.source === 'demo').toBe(true);

    const p2 = verifyEvidence({ quest, landmarkName: 'X', image: { uri: 'file://a.jpg', base64: null, mimeType: 'image/jpeg' } }, { demoOutcome: 'reject' });
    jest.advanceTimersByTime(2000);
    const no = await p2;
    expect(no.ok && !no.result.accepted).toBe(true);
    jest.useRealTimers();
  });
});

describe('simulated party service', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const self = { id: 'me', name: 'Wren', avatarHue: 20, level: 2 };

  it('creates, fills to capacity (max 4), chats and leaves', () => {
    const svc = new SimulatedPartyService(1);
    svc.connect();
    jest.advanceTimersByTime(600);
    expect(svc.snapshot().connection).toBe('simulated');
    const nearby = svc.snapshot().nearby;
    expect(nearby.every((p) => p.isDemo)).toBe(true);

    svc.createParty(self, null);
    nearby.forEach((p) => svc.invite(p.id));
    jest.advanceTimersByTime(5000);
    const party = svc.snapshot().party!;
    expect(party.members.length).toBe(4);
    expect(party.members.filter((m) => m.isDemo).every((m) => m.ready)).toBe(true);

    svc.setReady(true);
    expect(svc.snapshot().party!.members.find((m) => m.isSelf)?.ready).toBe(true);

    svc.sendMessage('hello 👋');
    expect(svc.snapshot().messages.some((m) => m.text === 'hello 👋')).toBe(true);

    svc.leaveParty();
    expect(svc.snapshot().party).toBeNull();
  });

  it('joins a demo host party', () => {
    const svc = new SimulatedPartyService(0);
    svc.connect();
    jest.advanceTimersByTime(10);
    svc.joinHostedParty(self, 'demo-mika');
    expect(svc.snapshot().party?.members.map((m) => m.id)).toEqual(['demo-mika', 'me']);
  });
});

describe('leaderboard', () => {
  const progress: Progress = { totalXp: 5000, xpByDay: {}, streak: 0, lastActiveDay: null, completions: [], visitedLandmarkIds: [], collectibles: [] };
  it('ranks the player and labels demo profiles', () => {
    const rows = buildLeaderboard('allTime', DEMO_PLAYER_PROFILE, progress, '2026-10-17');
    expect(rows[0]).toMatchObject({ isSelf: true, rank: 1 });
    expect(rows.filter((r) => !r.isSelf).every((r) => r.isDemo)).toBe(true);
  });
  it('updates the daily board immediately from xpByDay', () => {
    const before = buildLeaderboard('daily', DEMO_PLAYER_PROFILE, progress, '2026-10-17').find((r) => r.isSelf)!;
    const after = buildLeaderboard('daily', DEMO_PLAYER_PROFILE, { ...progress, xpByDay: { '2026-10-17': 999 } }, '2026-10-17').find((r) => r.isSelf)!;
    expect(before.value).toBe(0);
    expect(after.rank).toBe(1);
  });
});
