/**
 * Accounts, cloud mapping and real parties, with Supabase mocked at the module boundary.
 * (Database functions themselves are tested against the live project; see README.)
 */
const mockRpc = jest.fn();
const mockExchange = jest.fn();

jest.mock('../src/services/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
      signOut: () => Promise.resolve({ error: null }),
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => Promise.resolve('ok'),
  },
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `thaw://${path}`,
  parse: (url: string) => {
    const u = new URL(url.replace(/^thaw:\/\//, 'https://x/'));
    const queryParams: Record<string, string> = {};
    u.searchParams.forEach((v, k) => (queryParams[k] = v));
    return { path: u.pathname.replace(/^\//, ''), queryParams };
  },
}));

// eslint-disable-next-line import/first
import { friendlyAuthError, handleAuthDeepLink, validateDisplayName, validateEmail, validatePassword } from '../src/services/auth';
// eslint-disable-next-line import/first
import { mapCloudRows } from '../src/services/cloud';
// eslint-disable-next-line import/first
import { mapPartyState, SupabasePartyService } from '../src/services/supabaseParty';

beforeEach(() => {
  mockRpc.mockReset();
  mockExchange.mockReset();
});

describe('auth validation', () => {
  it('validates email', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail('nope')).toBeTruthy();
    expect(validateEmail('  wren@example.com ')).toBeNull();
  });
  it('validates password strength', () => {
    expect(validatePassword('short1')).toMatch(/at least/);
    expect(validatePassword('lettersonly')).toMatch(/letters and numbers/);
    expect(validatePassword('thaw2026ok')).toBeNull();
  });
  it('validates display names (Unicode-aware)', () => {
    expect(validateDisplayName('   ')).toBeTruthy();
    expect(validateDisplayName('代々木の探検家🌳')).toBeNull();
    expect(validateDisplayName('x'.repeat(25))).toMatch(/24/);
  });
  it('maps Supabase error codes to friendly text', () => {
    expect(friendlyAuthError({ message: 'x', code: 'invalid_credentials' })).toMatch(/incorrect/);
    expect(friendlyAuthError({ message: 'x', code: 'email_not_confirmed' })).toMatch(/verify/);
    expect(friendlyAuthError({ message: 'Email address not authorized' })).toMatch(/can’t send email/);
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toMatch(/connection/);
  });
});

describe('auth deep links', () => {
  it('exchanges the PKCE code from a confirmation link', async () => {
    mockExchange.mockResolvedValue({ error: null });
    await expect(handleAuthDeepLink('thaw://auth/confirm?code=abc')).resolves.toEqual({ kind: 'confirmed' });
    expect(mockExchange).toHaveBeenCalledWith('abc');
  });
  it('routes password reset links', async () => {
    mockExchange.mockResolvedValue({ error: null });
    await expect(handleAuthDeepLink('thaw://auth/reset?code=xyz')).resolves.toEqual({ kind: 'reset' });
  });
  it('surfaces expired links without exchanging', async () => {
    const r = await handleAuthDeepLink('thaw://auth/confirm?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid');
    expect(r).toMatchObject({ kind: 'error' });
    expect(mockExchange).not.toHaveBeenCalled();
  });
  it('ignores unrelated links', async () => {
    await expect(handleAuthDeepLink('thaw://quests/123')).resolves.toEqual({ kind: 'ignored' });
  });
});

describe('cloud mapping', () => {
  it('maps DB rows into the progress model, including onboarding state', () => {
    const snap = mapCloudRows({
      profile: { id: 'u', display_name: 'Mika', avatar_hue: 150, created_at: '', updated_at: '', onboarded_at: '2026-10-17T10:00:00Z' },
      stats: { user_id: 'u', total_xp: 330, quests_completed: 3, landmarks_visited: 2, streak: 4, last_active_day: '2026-10-17', last_completion_at: null, updated_at: '' },
      completions: [
        { id: 1, user_id: 'u', quest_id: 'q1', landmark_id: 'l1', landmark_name: 'Park', quest_title: 'Leaf', difficulty: 'easy', mode: 'solo', party_size: 1, xp: 80, collectible_id: 'pin:l1:botanical', day: '2026-10-17', completed_at: '2026-10-17T10:00:00Z' },
      ],
      collectibles: [{ user_id: 'u', collectible_id: 'pin:l1:botanical', name: 'Leaf', theme: 'botanical', rarity: 'weird', landmark_name: 'Park', unlocked_at: '2026-10-17T10:00:00Z' }],
      daily: [{ user_id: 'u', day: '2026-10-17', xp: 80 }],
      visited: [{ landmark_id: 'l1' }, { landmark_id: 'l2' }],
    });
    expect(snap.profile).toEqual({ displayName: 'Mika', avatarHue: 150, onboarded: true });
    expect(snap.progress.totalXp).toBe(330);
    expect(snap.progress.collectibles[0]?.rarity).toBe('common'); // unknown values coerced safely
    expect(snap.progress.visitedLandmarkIds).toEqual(['l1', 'l2']);
  });

  it('treats a missing onboarded_at as a new player', () => {
    const snap = mapCloudRows({ profile: { id: 'u', display_name: 'New', avatar_hue: 28, created_at: '', updated_at: '', onboarded_at: null }, stats: null, completions: [], collectibles: [], daily: [], visited: [] });
    expect(snap.profile.onboarded).toBe(false);
    expect(snap.progress.totalXp).toBe(0);
  });
});

const serverState = {
  id: 'p1',
  code: 'ABC234',
  quest_id: 'q-1',
  quest_title: 'Human Compass',
  expires_at: '2026-10-18T10:00:00Z',
  is_host: false,
  members: [
    { key: 'k1', name: 'Host', hue: 150, xp: 300, ready: true, is_host: true, is_self: false },
    { key: 'k2', name: 'Me', hue: 28, xp: 0, ready: false, is_host: false, is_self: true },
  ],
  messages: [{ id: 7, author_key: 'k1', author_name: 'Host', body: 'Meet at the fountain?', at: '2026-10-17T10:00:00Z', is_self: false }],
};

describe('real parties', () => {
  it('maps server party state (no user ids, real members only)', () => {
    const { party, messages } = mapPartyState(serverState);
    expect(party).toMatchObject({ code: 'ABC234', questTitle: 'Human Compass', isHost: false, name: 'Host’s party' });
    expect(party?.members.map((m) => [m.name, m.isSelf, m.isDemo, m.level])).toEqual([
      ['Host', false, false, 3],
      ['Me', true, false, 1],
    ]);
    expect(messages[0]).toMatchObject({ text: 'Meet at the fountain?', authorName: 'Host' });
    expect(mapPartyState(null)).toEqual({ party: null, messages: [] });
  });

  it('joins by code and surfaces friendly errors', async () => {
    const svc = new SupabasePartyService();
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'party_full' } });
    expect(await svc.joinByCode('ABC234')).toBe(false);
    expect(svc.error()).toBe('party_full');

    mockRpc.mockResolvedValueOnce({ data: serverState, error: null });
    expect(await svc.joinByCode('abc-234')).toBe(true);
    expect(svc.snapshot().party?.code).toBe('ABC234');
    expect(svc.error()).toBeNull();
    expect(mockRpc).toHaveBeenLastCalledWith('join_party', { p_code: 'abc-234' });
    svc.disconnect();
  });

  it('leaving clears local state immediately', async () => {
    const svc = new SupabasePartyService();
    mockRpc.mockResolvedValueOnce({ data: serverState, error: null });
    await svc.joinByCode('ABC234');
    mockRpc.mockResolvedValue({ data: null, error: null });
    svc.leaveParty();
    expect(svc.snapshot().party).toBeNull();
    svc.disconnect();
  });
});
