import { SimulatedPartyService } from '../src/services/photon';
import { buildLeaderboard } from '../src/game/leaderboard';
import { seededLandmarks } from '../src/data/regions';
import type { Progress, Quest } from '../src/types';

const mockInvoke = jest.fn();
jest.mock('../src/services/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => undefined,
      renderAsync: async () => ({ width: 800, height: 600, saveAsync: async () => ({ base64: 'QUJD'.repeat(40) }) }),
    }),
  },
}));

// eslint-disable-next-line import/first
import { generateQuests } from '../src/services/gemini';
// eslint-disable-next-line import/first
import { verifyDemo, verifyWithServer } from '../src/services/verification';

beforeEach(() => mockInvoke.mockReset());

const req = {
  landmarks: seededLandmarks('seattle'),
  playerPosition: { latitude: 47.6553, longitude: -122.3051 },
  localeHint: 'en-US',
  regionName: null,
  partySize: 1,
  preferSolo: false,
  mobilityFriendly: false,
  useAi: true,
  now: new Date(2026, 9, 17, 13),
};

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

describe('quest generation (Gemini via Edge Function)', () => {
  it('uses built-in quests without calling the server when AI is off', async () => {
    const batch = await generateQuests({ ...req, useAi: false });
    expect(batch.source).toBe('local');
    expect(batch.quests.length).toBe(req.landmarks.length * 2);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('merges validated AI quests and drops unsafe ones', async () => {
    mockInvoke.mockResolvedValue({ data: { quests: [aiQuest, { ...aiQuest, title: 'Bad', instructions: ['Climb the fence please'] }] }, error: null });
    const batch = await generateQuests(req);
    expect(mockInvoke).toHaveBeenCalledWith('generate-quests', expect.objectContaining({ method: 'POST' }));
    const body = (mockInvoke.mock.calls[0] as [string, { body: { landmarks: unknown[] } }])[1].body;
    expect(body.landmarks.length).toBeLessThanOrEqual(10);
    expect(batch.source).toBe('mixed');
    expect(batch.quests.some((q: Quest) => q.source === 'gemini' && q.title === 'Ripple Reader')).toBe(true);
    expect(batch.quests.some((q: Quest) => q.title === 'Bad')).toBe(false);
    for (const l of req.landmarks) expect(batch.quests.some((q: Quest) => q.landmarkId === l.id)).toBe(true);
  });

  it.each([
    ['503 (no key configured)', { data: null, error: { context: { status: 503 } } }],
    ['malformed', { data: { nope: true }, error: null }],
  ])('falls back to built-in quests on %s', async (_, res) => {
    mockInvoke.mockResolvedValue(res);
    const batch = await generateQuests(req);
    expect(batch.source).toBe('local');
    expect(batch.quests.length).toBeGreaterThan(0);
  });

  it('falls back when the network throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));
    expect((await generateQuests(req)).source).toBe('local');
  });

  it('respects player preferences', async () => {
    const solo = await generateQuests({ ...req, useAi: false, preferSolo: true });
    expect(solo.quests.every((q) => q.mode === 'solo')).toBe(true);
    const easy = await generateQuests({ ...req, useAi: false, mobilityFriendly: true });
    expect(easy.quests.every((q) => q.difficulty !== 'hard' && q.durationMin <= 25)).toBe(true);
  });
});

const quest = {
  id: 'q-local-sea-quad-x',
  landmarkId: 'sea-quad',
  title: 'Pattern Underfoot',
  evidence: 'A top-down photo of a ground pattern.',
  difficulty: 'easy',
  mode: 'solo',
  collectible: { theme: 'architecture', rarity: 'common', name: 'Quad Archway' },
} as Quest;

describe('photo verification (Gemini via Edge Function)', () => {
  it('sends a downscaled JPEG and returns the server reward when accepted', async () => {
    const reward = { duplicate: false, xp_gained: 80, total_xp: 80, streak: 1, new_landmark: true, party_size: 1, collectible: null };
    mockInvoke.mockResolvedValue({ data: { status: 'accepted', confidence: 0.9, observations: 'brick tiles', feedback: 'Great find!', reward }, error: null });
    const r = await verifyWithServer(quest, 'Liberal Arts Quad', 'file://photo.jpg');
    expect(r).toMatchObject({ kind: 'accepted', source: 'gemini', reward: { xp_gained: 80 } });
    const body = (mockInvoke.mock.calls[0] as [string, { body: { image: { mimeType: string; base64: string }; quest: { id: string } } }])[1].body;
    expect(mockInvoke.mock.calls[0]?.[0]).toBe('verify-evidence');
    expect(body.image.mimeType).toBe('image/jpeg');
    expect(body.quest.id).toBe(quest.id);
  });

  it('returns Gemini feedback when rejected', async () => {
    mockInvoke.mockResolvedValue({ data: { status: 'rejected', confidence: 0.2, observations: 'a screen', feedback: 'Try the real thing!' }, error: null });
    await expect(verifyWithServer(quest, 'Quad', 'file://p.jpg')).resolves.toMatchObject({ kind: 'rejected', feedback: 'Try the real thing!' });
  });

  it.each([
    [503, { error: 'verifier_unavailable' }, 'unavailable'],
    [429, { error: 'rate_limited' }, 'rate_limited'],
    [429, { error: 'quest_rate_limited' }, 'quest_rate_limited'],
    [429, { error: 'daily_limit' }, 'daily_limit'],
    [401, { error: 'not_authenticated' }, 'auth'],
    [400, { error: 'invalid_input' }, 'invalid'],
  ])('maps HTTP %s %j to %s', async (status, body, code) => {
    mockInvoke.mockResolvedValue({ data: null, error: { context: { status, json: async () => body } } });
    await expect(verifyWithServer(quest, 'Quad', 'file://p.jpg')).resolves.toMatchObject({ kind: 'error', code });
  });

  it('demo verification is simulated and clearly labelled', async () => {
    await expect(verifyDemo('accept', 0)).resolves.toMatchObject({ kind: 'accepted', source: 'demo' });
    await expect(verifyDemo('reject', 0)).resolves.toMatchObject({ kind: 'rejected', source: 'demo' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('simulated party service (demo mode only)', () => {
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
    expect(svc.snapshot().party!.members.length).toBe(4);
    svc.sendMessage('hello 👋');
    expect(svc.snapshot().messages.some((m) => m.text === 'hello 👋')).toBe(true);
    svc.leaveParty();
    expect(svc.snapshot().party).toBeNull();
  });
});

describe('demo leaderboard', () => {
  const progress: Progress = { totalXp: 5000, xpByDay: {}, streak: 0, lastActiveDay: null, completions: [], visitedLandmarkIds: [], collectibles: [] };
  const me = { id: 'me', name: 'Wren', avatarHue: 28, homeRegionId: null };
  it('ranks the player against labelled demo profiles', () => {
    const rows = buildLeaderboard('allTime', me, progress, '2026-10-17');
    expect(rows[0]).toMatchObject({ isSelf: true, rank: 1 });
    expect(rows.filter((r) => !r.isSelf).every((r) => r.isDemo)).toBe(true);
  });
});
